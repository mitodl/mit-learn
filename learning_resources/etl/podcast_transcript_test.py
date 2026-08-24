"""Tests for podcast transcript selection, fetching and parsing"""

import pytest
from bs4 import BeautifulSoup as bs  # noqa: N813

from learning_resources.etl.podcast_transcript import (
    MAX_TRANSCRIPT_CANDIDATES,
    TRANSCRIPT_TYPE_PREFERENCE,
    _is_public_ip,
    _parsed_public_url,
    fetch_transcript,
    parse_cue_format,
    parse_html,
    parse_plain,
    parse_podcast_index_json,
    parse_transcript_tags,
    rank_transcript_candidates,
    select_transcript_url,
    transcript_tags_from_rss,
)

ITEM_TEMPLATE = """
<rss {namespace}>
  <channel>
    <item>
      <title>An episode</title>
      {tags}
    </item>
  </channel>
</rss>
"""

PODCAST_NS = 'xmlns:podcast="https://podcastindex.org/namespace/1.0"'


def _item(tags, *, namespace=PODCAST_NS):
    """Build an <item> soup element carrying the given transcript tags"""
    return bs(ITEM_TEMPLATE.format(namespace=namespace, tags=tags), "xml").find("item")


@pytest.mark.parametrize("namespace", [PODCAST_NS, ""])
def test_parse_transcript_tags_tolerates_undeclared_namespace(namespace):
    """
    Tags are found whether or not the feed declares xmlns:podcast.

    lxml in recover mode drops an undeclared prefix, so a
    find_all("podcast:transcript") selector would silently return nothing for
    the feeds that get the declaration wrong.
    """
    item = _item(
        '<podcast:transcript url="https://x/t.vtt" type="text/vtt" language="en"'
        ' rel="captions"/>',
        namespace=namespace,
    )
    assert parse_transcript_tags(item) == [
        {
            "url": "https://x/t.vtt",
            "type": "text/vtt",
            "language": "en",
        }
    ]


def test_parse_transcript_tags_empty_when_absent():
    """An item with no transcript tag yields an empty list"""
    assert parse_transcript_tags(_item("")) == []


def test_transcript_tags_survive_the_rss_round_trip():
    """
    Tags are recoverable from a stored PodcastEpisode.rss fragment.

    This is what lets the feature work without a new column: the ETL already
    saves `item.prettify()`. That drops the xmlns:podcast declaration, so the
    re-parsed tags come back unprefixed -- which is precisely why
    parse_transcript_tags matches on local name instead of "podcast:transcript".
    """
    item = _item(
        '<podcast:transcript url="https://x/t.vtt" type="text/vtt"'
        ' language="en"/>'
        '<podcast:transcript url="https://x/t.srt" type="application/srt"'
        ' rel="captions"/>'
    )
    stored = item.prettify()

    # The declaration is gone, but the tag text -- and so the queryset filter
    # get_podcast_episodes_for_transcripts_job uses -- survives.
    assert "xmlns:podcast" not in stored
    assert "<podcast:transcript" in stored

    assert transcript_tags_from_rss(stored) == [
        {
            "url": "https://x/t.vtt",
            "type": "text/vtt",
            "language": "en",
        },
        {
            "url": "https://x/t.srt",
            "type": "application/srt",
            "language": None,
        },
    ]


def test_transcript_tags_survive_round_trip_without_declaration():
    """
    A feed that never declared the namespace still round-trips.

    lxml strips the undeclared prefix on the way in, so the stored fragment
    reads "<transcript" -- the other spelling the candidate queryset matches.
    """
    stored = _item(
        '<podcast:transcript url="https://x/t.vtt" type="text/vtt"/>',
        namespace="",
    ).prettify()

    assert "<transcript" in stored
    assert transcript_tags_from_rss(stored) == [
        {
            "url": "https://x/t.vtt",
            "type": "text/vtt",
            "language": None,
        }
    ]


@pytest.mark.parametrize("rss", [None, "", "<item><title>No tags</title></item>"])
def test_transcript_tags_from_rss_empty(rss):
    """A missing or tagless rss fragment yields no entries"""
    assert transcript_tags_from_rss(rss) == []


def test_parse_transcript_tags_skips_tags_with_no_url():
    """A tag missing the required url attribute is unusable"""
    assert parse_transcript_tags(_item('<podcast:transcript type="text/vtt"/>')) == []


def test_select_transcript_url_prefers_better_formats():
    """
    Formats are ranked by the quality of the files feeds actually serve.

    Captivate publishes a malformed text/html alongside a clean SRT, so html
    must lose to every other format.
    """
    entries = [
        {"url": "h", "type": "text/html", "language": None},
        {"url": "j", "type": "application/json", "language": None},
        {"url": "s", "type": "application/srt", "language": None},
        {"url": "v", "type": "text/vtt", "language": None},
        {"url": "p", "type": "text/plain", "language": None},
    ]
    assert select_transcript_url(entries)["url"] == "p"
    assert select_transcript_url(entries[:-1])["url"] == "v"
    assert select_transcript_url(entries[:-2])["url"] == "s"
    assert select_transcript_url(entries[:1])["url"] == "h"


def test_select_transcript_url_accepts_both_srt_spellings():
    """application/srt is non-standard but three MIT feeds send it"""
    for mime_type in ("application/srt", "application/x-subrip"):
        entry = {"url": "s", "type": mime_type, "language": None}
        assert select_transcript_url([entry]) == entry


@pytest.mark.parametrize(
    ("language", "expected"),
    [
        (None, True),
        ("", True),
        ("en", True),
        ("en-US", True),
        ("EN-GB", True),
        ("es", False),
        ("de-DE", False),
    ],
)
def test_select_transcript_url_language_filter(language, expected):
    """
    Non-English transcripts are dropped, not merely deranked.

    The stored text is analyzed with the english analyzer and shown under a
    Transcript tab, so a Spanish translation of an English show is worse than
    nothing.
    """
    entry = {"url": "v", "type": "text/vtt", "language": language}
    assert (select_transcript_url([entry]) is not None) is expected


def test_select_transcript_url_prefers_english_over_unlabeled():
    """An explicit en tag wins over one with no language, at the same type"""
    unlabeled = {"url": "a", "type": "text/vtt", "language": None}
    english = {"url": "b", "type": "text/plain", "language": "en"}
    assert select_transcript_url([unlabeled, english])["url"] == "b"


def test_select_transcript_url_ignores_unknown_types():
    """A type we have no parser for is not selectable"""
    assert (
        select_transcript_url(
            [{"url": "x", "type": "application/pdf", "language": None}]
        )
        is None
    )


def test_select_transcript_url_handles_empty():
    """No tags means no selection"""
    assert select_transcript_url([]) is None
    assert select_transcript_url(None) is None


def test_rank_transcript_candidates_keeps_every_usable_tag():
    """
    Ranking returns the losers too, so fetch_transcript can fall through.

    A feed lists the same transcript in several formats, so a broken url in the
    preferred one must not cost the episode the transcript entirely.
    """
    entries = [
        {"url": "h", "type": "text/html", "language": None},
        {"url": "p", "type": "text/plain", "language": None},
        {"url": "v", "type": "text/vtt", "language": None},
    ]
    assert [c.url for c in rank_transcript_candidates(entries)] == ["p", "v", "h"]


def test_rank_transcript_candidates_drops_unusable_tags():
    """Unparseable types and non-English languages never become candidates"""
    entries = [
        {"url": "x", "type": "application/pdf", "language": None},
        {"url": "es", "type": "text/vtt", "language": "es"},
        {"url": "v", "type": "text/vtt", "language": "en"},
    ]
    assert [c.url for c in rank_transcript_candidates(entries)] == ["v"]


def test_rank_transcript_candidates_caps_the_list(caplog):
    """One item cannot provoke unbounded requests, and the cap is not silent"""
    entries = [
        {"url": f"u{index}", "type": mime_type, "language": None}
        for index, mime_type in enumerate(TRANSCRIPT_TYPE_PREFERENCE)
    ]
    candidates = rank_transcript_candidates(entries)
    assert [c.media_type for c in candidates] == list(
        TRANSCRIPT_TYPE_PREFERENCE[:MAX_TRANSCRIPT_CANDIDATES]
    )
    assert "trying only the best" in caplog.text


@pytest.mark.parametrize(
    ("url", "declared_type", "expected"),
    [
        # The spec makes `type` required; some feeds omit it anyway.
        ("https://h.example/t.srt", None, "application/x-subrip"),
        ("https://h.example/t.srt", "", "application/x-subrip"),
        # A spelling outside TRANSCRIPT_TYPE_PREFERENCE.
        ("https://h.example/t.srt", "text/srt", "application/x-subrip"),
        ("https://h.example/t.vtt", None, "text/vtt"),
        ("https://h.example/t.json", None, "application/json"),
        ("https://h.example/t.txt", None, "text/plain"),
        ("https://h.example/t.htm", None, "text/html"),
        # A query string must not defeat the extension read.
        ("https://h.example/t.vtt?token=abc", None, "text/vtt"),
        # Nothing to go on: no usable type, no extension we can parse.
        ("https://h.example/transcript", None, None),
        ("https://h.example/t.pdf", None, None),
    ],
)
def test_media_type_falls_back_to_the_url_extension(url, declared_type, expected):
    """
    A tag with no usable `type` is identified by its url extension instead.

    Dropping it would make the episode look transcript-less. The response's own
    Content-Type is still checked before the body is parsed.
    """
    candidates = rank_transcript_candidates(
        [{"url": url, "type": declared_type, "language": None}]
    )
    assert (candidates[0].media_type if candidates else None) == expected


def test_declared_type_wins_over_the_url_extension():
    """A recognised `type` is authoritative even when the extension disagrees"""
    entries = [{"url": "https://h.example/t.html", "type": "text/vtt"}]
    assert rank_transcript_candidates(entries)[0].media_type == "text/vtt"


VTT = """WEBVTT

NOTE
This file was generated by a tool

00:00:02.939 --> 00:00:05.400
<v Susan Silbey>Welcome to the show,

00:00:05.400 --> 00:00:10.199
<v Susan Silbey>a show about big questions.

00:00:10.199 --> 00:00:11.519
<v Emily Pollock>What do we value and why?
"""

SRT = """1
00:00:00,567 --> 00:00:03,570
Sebastian Lourido: And we come back and I have
kind of swollen lymph nodes.

2
00:00:03,603 --> 00:00:06,606
I don't feel terrible, but

3
00:00:07,607 --> 00:00:09,542
it's notable.
"""


def test_parse_cue_format_vtt_uses_voice_tags():
    """VTT voice tags become speaker labels and start new paragraphs"""
    assert parse_cue_format(VTT) == (
        "Susan Silbey: Welcome to the show, a show about big questions."
        "\n\nEmily Pollock: What do we value and why?"
    )


def test_parse_cue_format_drops_headers_and_timings():
    """WEBVTT, NOTE blocks, cue numbers and timing lines never survive"""
    output = parse_cue_format(VTT)
    for artifact in ("WEBVTT", "NOTE", "-->", "00:00:02", "<v "):
        assert artifact not in output


def test_parse_cue_format_srt_joins_cues_into_sentences():
    """
    SRT cues break mid-sentence, so they are joined rather than paragraphed.

    A single stray "Name: " label is not treated as turn structure -- Captivate's
    SRT has exactly one across 861 cues, and attributing the whole episode to
    that speaker would be wrong -- but the text is kept verbatim rather than
    stripped, because it is real content either way.
    """
    assert parse_cue_format(SRT) == (
        "Sebastian Lourido: And we come back and I have kind of swollen"
        " lymph nodes. I don't feel terrible, but it's notable."
    )


def test_parse_cue_format_keeps_recurring_speaker_labels():
    """Inline labels that recur do describe turns, so they are kept"""
    srt = """1
00:00:00,000 --> 00:00:02,000
Alice: Good morning.

2
00:00:02,000 --> 00:00:04,000
Bob: Morning, Alice.
"""
    assert parse_cue_format(srt) == "Alice: Good morning.\n\nBob: Morning, Alice."


def test_parse_cue_format_keeps_colons_that_are_not_speakers():
    """
    A cue containing a colon mid-sentence keeps its opening words.

    The inline-label pattern matches "The bottom line: " the same way it
    matches "Alice: ", so the prefix is only removed once the file as a whole
    shows recurring labels. Otherwise the text is used verbatim -- dropping it
    silently deleted content.
    """
    srt = """1
00:00:00,000 --> 00:00:03,000
The bottom line: we need more funding.

2
00:00:03,000 --> 00:00:06,000
And that is the whole story here.
"""
    output = parse_cue_format(srt)
    assert output.startswith("The bottom line: we need more funding.")


def test_parse_cue_format_drops_repeated_cues():
    """Rolling captions repeat a cue verbatim as the window scrolls"""
    srt = """1
00:00:00,000 --> 00:00:02,000
the same line

2
00:00:02,000 --> 00:00:04,000
the same line
"""
    assert parse_cue_format(srt) == "the same line"


def test_parse_cue_format_empty():
    """An empty body yields an empty transcript"""
    assert parse_cue_format("") == ""


def test_parse_cue_format_decodes_character_references():
    """
    WebVTT requires "&" to be written "&amp;", so cue text arrives escaped.

    Left encoded, the stored transcript shows the literal entity and React
    escapes the ampersand a second time on render. Decoding happens after the
    tags are stripped so an escaped "&lt;i&gt;" stays text.
    """
    vtt = (
        "WEBVTT\n\n"
        "00:00:01.000 --> 00:00:03.000\n"
        "<v Ada &amp; Grace>R&amp;D at &lt;MIT&gt;&nbsp;matters.\n\n"
        "00:00:03.000 --> 00:00:05.000\n"
        "<v Bob>Fifty&nbsp;percent.\n"
    )
    assert parse_cue_format(vtt) == (
        "Ada & Grace: R&D at <MIT> matters.\n\nBob: Fifty percent."
    )


def test_parse_podcast_index_json_merges_fragmented_segments():
    """
    The podcastindex format fragments body mid-sentence.

    Adjacent segments by the same speaker are merged back into one paragraph.
    """
    payload = (
        '{"version":"1.0.0","segments":['
        '{"speaker":"Susan","startTime":1,"body":"Welcome"},'
        '{"speaker":"Susan","startTime":2,"body":"to the show."},'
        '{"speaker":"Emily","startTime":3,"body":"What do we value?"}]}'
    )
    assert parse_podcast_index_json(payload) == (
        "Susan: Welcome to the show.\n\nEmily: What do we value?"
    )


@pytest.mark.parametrize(
    "payload", ["not json at all", "[]", '{"version":"1.0.0"}', '{"segments":"nope"}']
)
def test_parse_podcast_index_json_bad_payloads(payload):
    """Malformed or unexpected JSON yields no transcript rather than raising"""
    assert parse_podcast_index_json(payload) == ""


def test_parse_html_recovers_captivate_srt_dump():
    """
    Captivate marks up only the first cue and dumps raw SRT after it.

    The extracted text still contains cue timings, so it is routed through the
    cue parser and the timecodes do not reach the stored transcript.
    """
    html = (
        "<cite>Sebastian Lourido:</cite><time>00:00:00</time>"
        "<p>And we come back.</p>"
        "<p> </p><p> 2</p><p> 00:00:03,603 --&gt; 00:00:06,606</p>"
        "<p> I don't feel terrible, but</p>"
        "<p> </p><p> 3</p><p> 00:00:07,607 --&gt; 00:00:09,542</p>"
        "<p> it's notable.</p>"
    )
    output = parse_html(html)
    for artifact in ("-->", "00:00:00", "00:00:03", "<p>", "<cite>"):
        assert artifact not in output
    assert "And we come back." in output
    assert "it's notable." in output


def test_parse_html_plain_document():
    """A well-formed HTML transcript is just its text"""
    html = "<html><body><p>First para.</p><p>Second para.</p></body></html>"
    assert parse_html(html) == "First para.\n\nSecond para."


def test_parse_html_does_not_double_decode_entities():
    """
    get_text() has already resolved character references.

    Decoding a second time would turn a doubly-escaped "&amp;amp;" -- how a
    literal "&amp;" is written in HTML -- into a bare ampersand, on both the
    plain and the cue-dump branch.
    """
    assert parse_html("<p>Write &amp;amp; for an ampersand.</p>") == (
        "Write &amp; for an ampersand."
    )
    captivate = (
        "<p>1</p><p>00:00:00,567 --&gt; 00:00:03,570</p>"
        "<p>Write &amp;amp; for an ampersand.</p>"
    )
    assert parse_html(captivate) == "Write &amp; for an ampersand."


def test_parse_plain_preserves_paragraphs():
    """Blank-line separated blocks stay separate; wrapping is normalized"""
    text = "Emily Wade (Host): A while\nback, we asked.\n\n\nAnd then this.\n"
    assert parse_plain(text) == (
        "Emily Wade (Host): A while back, we asked.\n\nAnd then this."
    )


@pytest.mark.parametrize(
    ("address", "expected"),
    [
        ("8.8.8.8", True),
        ("2600::1", True),
        ("127.0.0.1", False),
        ("10.0.0.1", False),
        ("172.17.0.2", False),
        ("192.168.1.1", False),
        ("169.254.169.254", False),
        ("0.0.0.0", False),  # noqa: S104
        ("100.64.0.1", False),
        ("::1", False),
        ("fe80::1", False),
        ("fd00::1", False),
        ("::ffff:169.254.169.254", False),
        ("2002:a9fe:a9fe::1", False),
        ("64:ff9b::a9fe:a9fe", False),
        ("not an ip", False),
    ],
)
def test_is_public_ip(address, expected):
    """
    Only publicly routable addresses may be fetched.

    The IPv6 cases all reach the cloud metadata endpoint by a different route:
    v4-mapped, 6to4 and NAT64 respectively. `is_global` alone would allow the
    NAT64 form, and the individual negatives alone would allow carrier NAT.
    """
    assert _is_public_ip(address) is expected


@pytest.mark.parametrize(
    "url",
    [
        "http://example.com/t.vtt",
        "file:///etc/passwd",
        "gopher://example.com/",
        "https://evil.io\\@example.com/t.vtt",
        "https://user@example.com/t.vtt",
        "https://",
        "",
        None,
        12345,
    ],
)
def test_parsed_public_url_rejects_unusable_urls(url):
    """
    Non-https schemes and confusable netlocs never reach the network.

    urllib reads `https://evil.io\\@ok.example` as a url on ok.example while
    browsers read it as evil.io, so the host we validate would not be the host
    contacted.
    """
    assert _parsed_public_url(url) is None


def test_parsed_public_url_rejects_private_host(mocker):
    """A name resolving into a private range is refused"""
    mocker.patch(
        "learning_resources.etl.podcast_transcript.socket.getaddrinfo",
        return_value=[(2, 1, 6, "", ("127.0.0.1", 443))],
    )
    assert _parsed_public_url("https://internal.example/t.vtt") is None


def test_parsed_public_url_rejects_split_horizon_host(mocker):
    """
    A host with one public and one private address is refused.

    We cannot control which record urllib3 picks, so any private answer is
    disqualifying.
    """
    mocker.patch(
        "learning_resources.etl.podcast_transcript.socket.getaddrinfo",
        return_value=[
            (2, 1, 6, "", ("8.8.8.8", 443)),
            (30, 1, 6, "", ("::1", 443, 0, 0)),
        ],
    )
    assert _parsed_public_url("https://split.example/t.vtt") is None


def test_parsed_public_url_accepts_public_host(mocker):
    """A name resolving only to public addresses is allowed"""
    mocker.patch(
        "learning_resources.etl.podcast_transcript.socket.getaddrinfo",
        return_value=[(2, 1, 6, "", ("8.8.8.8", 443))],
    )
    parsed = _parsed_public_url("https://ok.example/t.vtt")
    assert parsed is not None
    assert parsed.hostname == "ok.example"


@pytest.fixture
def public_dns(mocker):
    """Resolve every host to a public address"""
    return mocker.patch(
        "learning_resources.etl.podcast_transcript.socket.getaddrinfo",
        return_value=[(2, 1, 6, "", ("8.8.8.8", 443))],
    )


def test_fetch_transcript_parses_selected_entry(mocked_responses, public_dns):
    """The best entry is fetched and normalized"""
    mocked_responses.add(
        mocked_responses.GET,
        "https://ok.example/t.vtt",
        body=VTT,
        content_type="text/vtt",
    )
    entries = [
        {"url": "https://ok.example/t.html", "type": "text/html", "language": None},
        {"url": "https://ok.example/t.vtt", "type": "text/vtt", "language": "en"},
    ]
    assert fetch_transcript(entries).startswith("Susan Silbey: Welcome to the show,")


def test_fetch_transcript_no_usable_entry(public_dns):
    """Nothing selectable means no request and no transcript"""
    assert fetch_transcript([]) == ""


def test_fetch_transcript_refuses_redirect_into_private_range(mocked_responses, mocker):
    """
    A redirect off a legitimate host into the metadata endpoint is refused.

    requests would follow this itself, which is why redirects are disabled and
    every hop is revalidated.
    """
    mocker.patch(
        "learning_resources.etl.podcast_transcript.socket.getaddrinfo",
        side_effect=lambda host, *_args, **_kwargs: [
            (
                2,
                1,
                6,
                "",
                ("8.8.8.8" if host == "ok.example" else "169.254.169.254", 443),
            )
        ],
    )
    mocked_responses.add(
        mocked_responses.GET,
        "https://ok.example/t.vtt",
        status=302,
        headers={"Location": "https://metadata.example/latest/meta-data/"},
    )
    entries = [{"url": "https://ok.example/t.vtt", "type": "text/vtt"}]
    assert fetch_transcript(entries) == ""


def test_fetch_transcript_rejects_html_served_for_captions(
    mocked_responses,
    public_dns,
):
    """An error page served in place of a caption file is not stored as prose"""
    mocked_responses.add(
        mocked_responses.GET,
        "https://ok.example/t.vtt",
        body="<html><body>Not found</body></html>",
        content_type="text/html",
    )
    entries = [{"url": "https://ok.example/t.vtt", "type": "text/vtt"}]
    assert fetch_transcript(entries) == ""


def test_fetch_transcript_allows_text_plain_for_any_type(
    mocked_responses,
    public_dns,
):
    """
    Hosts are loose about Content-Type in the harmless direction.

    Captivate serves its application/srt file as text/plain and
    doctorpodcasting serves its text/vtt file as text/plain, so text/plain is
    accepted for any declared type.
    """
    mocked_responses.add(
        mocked_responses.GET,
        "https://ok.example/t.srt",
        body=SRT,
        content_type="text/plain",
    )
    entries = [{"url": "https://ok.example/t.srt", "type": "application/srt"}]
    assert "swollen lymph nodes" in fetch_transcript(entries)


def test_fetch_transcript_survives_request_failure(mocked_responses, public_dns):
    """A failing host yields no transcript rather than an exception"""
    mocked_responses.add(mocked_responses.GET, "https://ok.example/t.vtt", status=500)
    entries = [{"url": "https://ok.example/t.vtt", "type": "text/vtt"}]
    assert fetch_transcript(entries) == ""


def test_fetch_transcript_decodes_utf8_without_a_declared_charset(
    mocked_responses,
    public_dns,
):
    """
    Most hosts serve text/* with no charset parameter.

    requests reports ISO-8859-1 for those (RFC 2616), so trusting
    response.encoding would turn every non-ASCII name into mojibake.
    """
    body = "WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nJos\u00e9 was na\u00efve.\n"
    mocked_responses.add(
        mocked_responses.GET,
        "https://ok.example/t.vtt",
        body=body.encode("utf-8"),
        content_type="text/vtt",
    )
    entries = [{"url": "https://ok.example/t.vtt", "type": "text/vtt"}]
    assert fetch_transcript(entries) == "Jos\u00e9 was na\u00efve."


def test_fetch_transcript_honours_a_declared_charset(mocked_responses, public_dns):
    """A charset the server actually declared is the one used"""
    body = "WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nJos\u00e9 was here.\n"
    mocked_responses.add(
        mocked_responses.GET,
        "https://ok.example/t.vtt",
        body=body.encode("iso-8859-1"),
        content_type="text/vtt; charset=iso-8859-1",
    )
    entries = [{"url": "https://ok.example/t.vtt", "type": "text/vtt"}]
    assert fetch_transcript(entries) == "Jos\u00e9 was here."


def test_fetch_transcript_falls_back_when_the_charset_is_unknown(
    mocked_responses,
    public_dns,
):
    """A nonsense charset name is not worth discarding the body over"""
    mocked_responses.add(
        mocked_responses.GET,
        "https://ok.example/t.vtt",
        body=VTT.encode("utf-8"),
        content_type="text/vtt; charset=not-a-charset",
    )
    entries = [{"url": "https://ok.example/t.vtt", "type": "text/vtt"}]
    assert fetch_transcript(entries).startswith("Susan Silbey: Welcome to the show,")


def test_fetch_transcript_falls_back_to_the_next_format(mocked_responses, public_dns):
    """
    A 404 on the preferred format falls through to the next one.

    Feeds publish the same transcript several ways, so giving up on the first
    failure loses a transcript that was there all along -- and because the
    episode keeps an empty transcript, the same broken url is retried every run.
    """
    mocked_responses.add(mocked_responses.GET, "https://ok.example/t.vtt", status=404)
    mocked_responses.add(
        mocked_responses.GET,
        "https://ok.example/t.srt",
        body=SRT,
        content_type="application/srt",
    )
    entries = [
        {"url": "https://ok.example/t.srt", "type": "application/srt"},
        {"url": "https://ok.example/t.vtt", "type": "text/vtt"},
    ]
    assert "swollen lymph nodes" in fetch_transcript(entries)


def test_fetch_transcript_falls_back_past_an_html_error_page(
    mocked_responses,
    public_dns,
):
    """An error page served for the preferred format is not the end of it"""
    mocked_responses.add(
        mocked_responses.GET,
        "https://ok.example/t.vtt",
        body="<html><body>Not found</body></html>",
        content_type="text/html",
    )
    mocked_responses.add(
        mocked_responses.GET,
        "https://ok.example/t.srt",
        body=SRT,
        content_type="application/srt",
    )
    entries = [
        {"url": "https://ok.example/t.vtt", "type": "text/vtt"},
        {"url": "https://ok.example/t.srt", "type": "application/srt"},
    ]
    assert "swollen lymph nodes" in fetch_transcript(entries)


def test_fetch_transcript_falls_back_past_an_empty_parse(mocked_responses, public_dns):
    """A well-formed caption file with no cues in it is still no transcript"""
    mocked_responses.add(
        mocked_responses.GET,
        "https://ok.example/t.vtt",
        body="WEBVTT\n\n",
        content_type="text/vtt",
    )
    mocked_responses.add(
        mocked_responses.GET,
        "https://ok.example/t.srt",
        body=SRT,
        content_type="application/srt",
    )
    entries = [
        {"url": "https://ok.example/t.vtt", "type": "text/vtt"},
        {"url": "https://ok.example/t.srt", "type": "application/srt"},
    ]
    assert "swollen lymph nodes" in fetch_transcript(entries)


def test_fetch_transcript_empty_when_every_candidate_fails(
    mocked_responses,
    public_dns,
):
    """Exhausting the candidate list is the only way to give up"""
    mocked_responses.add(mocked_responses.GET, "https://ok.example/t.vtt", status=404)
    mocked_responses.add(mocked_responses.GET, "https://ok.example/t.srt", status=500)
    entries = [
        {"url": "https://ok.example/t.vtt", "type": "text/vtt"},
        {"url": "https://ok.example/t.srt", "type": "application/srt"},
    ]
    assert fetch_transcript(entries) == ""


def test_fetch_transcript_uses_an_untyped_url(mocked_responses, public_dns):
    """A tag with no `type` at all is fetched on the strength of its extension"""
    mocked_responses.add(
        mocked_responses.GET,
        "https://ok.example/t.srt",
        body=SRT,
        content_type="application/srt",
    )
    entries = [{"url": "https://ok.example/t.srt", "type": None}]
    assert "swollen lymph nodes" in fetch_transcript(entries)
