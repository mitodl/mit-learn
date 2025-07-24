import { useQuery } from "@tanstack/react-query"

export type VideoShort = {
  id: {
    videoId: string
  }
}

export const useVideoShortsList = (enabled: boolean) => {
  return useQuery({
    queryKey: ["youtube_shorts", "list"],
    queryFn: async () => {
      // const { data } = await axios.get(
      //   `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${YOUTUBE_CHANNEL_ID}&type=short&order=date&maxResults=50&key=${YOUTUBE_API_KEY}`,
      // )

      const data = MOCK_DATA

      return data.items
    },
    enabled,
  })
}

// API key needed to access public YouTube API (quota limited) - not sensitive
// const YOUTUBE_API_KEY = "AIzaSyBzQsnRUW5vkV8vYt9twPecl-nuM8ykLCY" // pragma: allowlist secret

// https://www.youtube.com/@MITOpenLearning
// const YOUTUBE_CHANNEL_ID = "UCN0QBfKk0ZSytyX_16M11fA"

// const CHANNEL_DATA_URL = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${YOUTUBE_CHANNEL_ID}&type=short&order=date&maxResults=50&key=${YOUTUBE_API_KEY}`

const MOCK_DATA = {
  kind: "youtube#searchListResponse",
  etag: "iS_rj-1fGQMg4bA1RoBjQIBsRek",
  nextPageToken: "CDIQAA",
  regionCode: "ES",
  pageInfo: {
    totalResults: 383,
    resultsPerPage: 50,
  },
  items: [
    {
      kind: "youtube#searchResult",
      etag: "lWbdE2ReFN8OWXg2UOPg1XA6b0E",
      id: {
        kind: "youtube#video",
        videoId: "WMoKNQ5Ityk",
      },
      snippet: {
        publishedAt: "2025-07-17T14:53:27Z",
        channelId: "UCN0QBfKk0ZSytyX_16M11fA",
        title: "How does the brain give rise to the mind?",
        description:
          "PSA: When you take MIT Prof. Nancy Kanwisher's course on the human brain, you're going to be studying cognitive science.",
        thumbnails: {
          default: {
            url: "https://i.ytimg.com/vi/WMoKNQ5Ityk/default.jpg",
            width: 120,
            height: 90,
          },
          medium: {
            url: "https://i.ytimg.com/vi/WMoKNQ5Ityk/mqdefault.jpg",
            width: 320,
            height: 180,
          },
          high: {
            url: "https://i.ytimg.com/vi/WMoKNQ5Ityk/hqdefault.jpg",
            width: 480,
            height: 360,
          },
        },
        channelTitle: "MIT Open Learning",
        liveBroadcastContent: "none",
        publishTime: "2025-07-17T14:53:27Z",
      },
    },
    {
      kind: "youtube#searchResult",
      etag: "-qq7EWtqrykn32rlx3Idl6eygyo",
      id: {
        kind: "youtube#video",
        videoId: "a6s6PK7Keew",
      },
      snippet: {
        publishedAt: "2025-07-10T19:33:07Z",
        channelId: "UCN0QBfKk0ZSytyX_16M11fA",
        title: "Why LeBron James should never mow his own lawn",
        description:
          "What's the difference between absolute advantage and comparative advantage? Jonathan Gruber, Ford Professor of Economics ...",
        thumbnails: {
          default: {
            url: "https://i.ytimg.com/vi/a6s6PK7Keew/default.jpg",
            width: 120,
            height: 90,
          },
          medium: {
            url: "https://i.ytimg.com/vi/a6s6PK7Keew/mqdefault.jpg",
            width: 320,
            height: 180,
          },
          high: {
            url: "https://i.ytimg.com/vi/a6s6PK7Keew/hqdefault.jpg",
            width: 480,
            height: 360,
          },
        },
        channelTitle: "MIT Open Learning",
        liveBroadcastContent: "none",
        publishTime: "2025-07-10T19:33:07Z",
      },
    },
    {
      kind: "youtube#searchResult",
      etag: "VRyHddOZLRPz3GTakNlU_YqHD74",
      id: {
        kind: "youtube#video",
        videoId: "5UWzLTg-lSs",
      },
      snippet: {
        publishedAt: "2025-07-03T14:44:23Z",
        channelId: "UCN0QBfKk0ZSytyX_16M11fA",
        title: "Global learning from MIT",
        description:
          "Esther Duflo, MIT Abdul Latif Jameel Professor of Poverty Alleviation and Development Economics, can teach learners around the ...",
        thumbnails: {
          default: {
            url: "https://i.ytimg.com/vi/5UWzLTg-lSs/default.jpg",
            width: 120,
            height: 90,
          },
          medium: {
            url: "https://i.ytimg.com/vi/5UWzLTg-lSs/mqdefault.jpg",
            width: 320,
            height: 180,
          },
          high: {
            url: "https://i.ytimg.com/vi/5UWzLTg-lSs/hqdefault.jpg",
            width: 480,
            height: 360,
          },
        },
        channelTitle: "MIT Open Learning",
        liveBroadcastContent: "none",
        publishTime: "2025-07-03T14:44:23Z",
      },
    },
    {
      kind: "youtube#searchResult",
      etag: "j-W77ueEU300TKOgKpYG9AlxsHA",
      id: {
        kind: "youtube#video",
        videoId: "W8eNYzwsjPo",
      },
      snippet: {
        publishedAt: "2025-06-26T13:56:52Z",
        channelId: "UCN0QBfKk0ZSytyX_16M11fA",
        title: "What are the best ways to approach alleviating poverty?",
        description:
          "People might think there's one answer to the problem of poverty, but the reality is more nuanced. Nobel Prize-winning economist ...",
        thumbnails: {
          default: {
            url: "https://i.ytimg.com/vi/W8eNYzwsjPo/default.jpg",
            width: 120,
            height: 90,
          },
          medium: {
            url: "https://i.ytimg.com/vi/W8eNYzwsjPo/mqdefault.jpg",
            width: 320,
            height: 180,
          },
          high: {
            url: "https://i.ytimg.com/vi/W8eNYzwsjPo/hqdefault.jpg",
            width: 480,
            height: 360,
          },
        },
        channelTitle: "MIT Open Learning",
        liveBroadcastContent: "none",
        publishTime: "2025-06-26T13:56:52Z",
      },
    },
    {
      kind: "youtube#searchResult",
      etag: "YBgJSVu_rIiomg7x_snLx3O1cRo",
      id: {
        kind: "youtube#video",
        videoId: "LehATCh72JE",
      },
      snippet: {
        publishedAt: "2025-06-18T19:52:19Z",
        channelId: "UCN0QBfKk0ZSytyX_16M11fA",
        title: "How can we make a better battery?",
        description:
          "As the modern world increasingly relies on electric power, how can we store that energy more efficiently? One answer is liquid ...",
        thumbnails: {
          default: {
            url: "https://i.ytimg.com/vi/LehATCh72JE/default.jpg",
            width: 120,
            height: 90,
          },
          medium: {
            url: "https://i.ytimg.com/vi/LehATCh72JE/mqdefault.jpg",
            width: 320,
            height: 180,
          },
          high: {
            url: "https://i.ytimg.com/vi/LehATCh72JE/hqdefault.jpg",
            width: 480,
            height: 360,
          },
        },
        channelTitle: "MIT Open Learning",
        liveBroadcastContent: "none",
        publishTime: "2025-06-18T19:52:19Z",
      },
    },
    // {
    //   kind: "youtube#searchResult",
    //   etag: "tZD_oaLU7WLjWasmFevP6_O5SsY",
    //   id: {
    //     kind: "youtube#video",
    //     videoId: "GzjBgEc9bug",
    //   },
    //   snippet: {
    //     publishedAt: "2025-06-12T13:32:55Z",
    //     channelId: "UCN0QBfKk0ZSytyX_16M11fA",
    //     title:
    //       "Alleviating poverty and sharing knowledge globally with Esther Duflo",
    //     description:
    //       "An Open Conversation hosted by Chris Capozzola Esther Duflo, an acclaimed economist renowned for her transformative ...",
    //     thumbnails: {
    //       default: {
    //         url: "https://i.ytimg.com/vi/GzjBgEc9bug/default.jpg",
    //         width: 120,
    //         height: 90,
    //       },
    //       medium: {
    //         url: "https://i.ytimg.com/vi/GzjBgEc9bug/mqdefault.jpg",
    //         width: 320,
    //         height: 180,
    //       },
    //       high: {
    //         url: "https://i.ytimg.com/vi/GzjBgEc9bug/hqdefault.jpg",
    //         width: 480,
    //         height: 360,
    //       },
    //     },
    //     channelTitle: "MIT Open Learning",
    //     liveBroadcastContent: "none",
    //     publishTime: "2025-06-12T13:32:55Z",
    //   },
    // },
    {
      kind: "youtube#searchResult",
      etag: "3zrMRzYeyeY_PCyQaTb_OLFy7Ys",
      id: {
        kind: "youtube#video",
        videoId: "p-q6I_CdWVk",
      },
      snippet: {
        publishedAt: "2025-06-10T14:20:29Z",
        channelId: "UCN0QBfKk0ZSytyX_16M11fA",
        title: "What is a digital twin?",
        description:
          'You may have heard people talking about "digital twins," but what are they and why are they useful? James Scott, a research ...',
        thumbnails: {
          default: {
            url: "https://i.ytimg.com/vi/p-q6I_CdWVk/default.jpg",
            width: 120,
            height: 90,
          },
          medium: {
            url: "https://i.ytimg.com/vi/p-q6I_CdWVk/mqdefault.jpg",
            width: 320,
            height: 180,
          },
          high: {
            url: "https://i.ytimg.com/vi/p-q6I_CdWVk/hqdefault.jpg",
            width: 480,
            height: 360,
          },
        },
        channelTitle: "MIT Open Learning",
        liveBroadcastContent: "none",
        publishTime: "2025-06-10T14:20:29Z",
      },
    },
    // {
    //   kind: "youtube#searchResult",
    //   etag: "a_fkEkvTDTFNC_o1j2AkN7cYTHc",
    //   id: {
    //     kind: "youtube#video",
    //     videoId: "l-H7TSCwIAE",
    //   },
    //   snippet: {
    //     publishedAt: "2025-05-29T15:32:24Z",
    //     channelId: "UCN0QBfKk0ZSytyX_16M11fA",
    //     title: "Matt Damon to MIT grads: &quot;Just keep listening&quot;",
    //     description:
    //       'The "Good Will Hunting" star offers words of advice to MIT\'s Class of 2016. Learn more about MIT Open Learning: ...',
    //     thumbnails: {
    //       default: {
    //         url: "https://i.ytimg.com/vi/l-H7TSCwIAE/default.jpg",
    //         width: 120,
    //         height: 90,
    //       },
    //       medium: {
    //         url: "https://i.ytimg.com/vi/l-H7TSCwIAE/mqdefault.jpg",
    //         width: 320,
    //         height: 180,
    //       },
    //       high: {
    //         url: "https://i.ytimg.com/vi/l-H7TSCwIAE/hqdefault.jpg",
    //         width: 480,
    //         height: 360,
    //       },
    //     },
    //     channelTitle: "MIT Open Learning",
    //     liveBroadcastContent: "none",
    //     publishTime: "2025-05-29T15:32:24Z",
    //   },
    // },
    {
      kind: "youtube#searchResult",
      etag: "DgvzpxBvByctqlKtp9w2WCirk50",
      id: {
        kind: "youtube#video",
        videoId: "sXbni0XPcZM",
      },
      snippet: {
        publishedAt: "2025-05-22T16:16:44Z",
        channelId: "UCN0QBfKk0ZSytyX_16M11fA",
        title: "What’s in a Smoot? A quirky MIT legacy explained",
        description:
          "It all started one night in October 1958 when MIT fraternity brothers laid Oliver Smoot's 5-foot, 7-inch frame end-to-end to measure ...",
        thumbnails: {
          default: {
            url: "https://i.ytimg.com/vi/sXbni0XPcZM/default.jpg",
            width: 120,
            height: 90,
          },
          medium: {
            url: "https://i.ytimg.com/vi/sXbni0XPcZM/mqdefault.jpg",
            width: 320,
            height: 180,
          },
          high: {
            url: "https://i.ytimg.com/vi/sXbni0XPcZM/hqdefault.jpg",
            width: 480,
            height: 360,
          },
        },
        channelTitle: "MIT Open Learning",
        liveBroadcastContent: "none",
        publishTime: "2025-05-22T16:16:44Z",
      },
    },
    {
      kind: "youtube#searchResult",
      etag: "eoGiFyH1lBFzaMkZ43g0mFlEPgs",
      id: {
        kind: "youtube#video",
        videoId: "qcYUP9Wnqao",
      },
      snippet: {
        publishedAt: "2025-05-20T14:39:14Z",
        channelId: "UCN0QBfKk0ZSytyX_16M11fA",
        title: "MIT Crew finds community on the water #shorts",
        description:
          "A sneak peek into MIT's crew team. Learn more about MIT Open Learning: https://openlearning.mit.edu/",
        thumbnails: {
          default: {
            url: "https://i.ytimg.com/vi/qcYUP9Wnqao/default.jpg",
            width: 120,
            height: 90,
          },
          medium: {
            url: "https://i.ytimg.com/vi/qcYUP9Wnqao/mqdefault.jpg",
            width: 320,
            height: 180,
          },
          high: {
            url: "https://i.ytimg.com/vi/qcYUP9Wnqao/hqdefault.jpg",
            width: 480,
            height: 360,
          },
        },
        channelTitle: "MIT Open Learning",
        liveBroadcastContent: "none",
        publishTime: "2025-05-20T14:39:14Z",
      },
    },
    // {
    //   kind: "youtube#searchResult",
    //   etag: "7W5ZcXD90oUIkdDIWcME3IxU7ZQ",
    //   id: {
    //     kind: "youtube#video",
    //     videoId: "r7fpDX_0Fss",
    //   },
    //   snippet: {
    //     publishedAt: "2025-05-19T15:59:19Z",
    //     channelId: "UCN0QBfKk0ZSytyX_16M11fA",
    //     title: "Day of Climate inspires young learners to take action",
    //     description:
    //       "Close your eyes and imagine we are on the same team. Same arena. Same jersey. And the game is on the line,” said Jaylen ...",
    //     thumbnails: {
    //       default: {
    //         url: "https://i.ytimg.com/vi/r7fpDX_0Fss/default.jpg",
    //         width: 120,
    //         height: 90,
    //       },
    //       medium: {
    //         url: "https://i.ytimg.com/vi/r7fpDX_0Fss/mqdefault.jpg",
    //         width: 320,
    //         height: 180,
    //       },
    //       high: {
    //         url: "https://i.ytimg.com/vi/r7fpDX_0Fss/hqdefault.jpg",
    //         width: 480,
    //         height: 360,
    //       },
    //     },
    //     channelTitle: "MIT Open Learning",
    //     liveBroadcastContent: "none",
    //     publishTime: "2025-05-19T15:59:19Z",
    //   },
    // },
    {
      kind: "youtube#searchResult",
      etag: "PaJZovVMiCDVOioxY713QRMMo84",
      id: {
        kind: "youtube#video",
        videoId: "7236CLtjwX8",
      },
      snippet: {
        publishedAt: "2025-05-15T16:28:28Z",
        channelId: "UCN0QBfKk0ZSytyX_16M11fA",
        title:
          "Explained: How scientists discover new exoplanets #shorts #exoplanets #astronomy",
        description:
          "MIT alum Ashley Villar breaks down the transit method, a powerful technique that spots tiny dips in a star's brightness when a ...",
        thumbnails: {
          default: {
            url: "https://i.ytimg.com/vi/7236CLtjwX8/default.jpg",
            width: 120,
            height: 90,
          },
          medium: {
            url: "https://i.ytimg.com/vi/7236CLtjwX8/mqdefault.jpg",
            width: 320,
            height: 180,
          },
          high: {
            url: "https://i.ytimg.com/vi/7236CLtjwX8/hqdefault.jpg",
            width: 480,
            height: 360,
          },
        },
        channelTitle: "MIT Open Learning",
        liveBroadcastContent: "none",
        publishTime: "2025-05-15T16:28:28Z",
      },
    },
    {
      kind: "youtube#searchResult",
      etag: "N4b2B5PBU-GTFoMnANuRUr98AJ8",
      id: {
        kind: "youtube#video",
        videoId: "eGXA3uhFOM8",
      },
      snippet: {
        publishedAt: "2025-05-13T17:04:41Z",
        channelId: "UCN0QBfKk0ZSytyX_16M11fA",
        title: "Can we regrow our livers? #shorts #LiverTransplant #StemCells",
        description:
          "In theory, liver cells can regrow to reform up to 75% of your liver tissue. In practice, these cells don't survive long enough outside ...",
        thumbnails: {
          default: {
            url: "https://i.ytimg.com/vi/eGXA3uhFOM8/default.jpg",
            width: 120,
            height: 90,
          },
          medium: {
            url: "https://i.ytimg.com/vi/eGXA3uhFOM8/mqdefault.jpg",
            width: 320,
            height: 180,
          },
          high: {
            url: "https://i.ytimg.com/vi/eGXA3uhFOM8/hqdefault.jpg",
            width: 480,
            height: 360,
          },
        },
        channelTitle: "MIT Open Learning",
        liveBroadcastContent: "none",
        publishTime: "2025-05-13T17:04:41Z",
      },
    },
    {
      kind: "youtube#searchResult",
      etag: "u77oT-SkBBccejmdRt40RcIAbI0",
      id: {
        kind: "youtube#video",
        videoId: "R1WLo0kJSzM",
      },
      snippet: {
        publishedAt: "2025-05-08T17:48:23Z",
        channelId: "UCN0QBfKk0ZSytyX_16M11fA",
        title: "How would warp drive actually work? 🚀 #astrophysics #shorts",
        description:
          "Warp drive may sound like science fiction, but NASA is researching whether it's possible to travel faster than the speed of light.",
        thumbnails: {
          default: {
            url: "https://i.ytimg.com/vi/R1WLo0kJSzM/default.jpg",
            width: 120,
            height: 90,
          },
          medium: {
            url: "https://i.ytimg.com/vi/R1WLo0kJSzM/mqdefault.jpg",
            width: 320,
            height: 180,
          },
          high: {
            url: "https://i.ytimg.com/vi/R1WLo0kJSzM/hqdefault.jpg",
            width: 480,
            height: 360,
          },
        },
        channelTitle: "MIT Open Learning",
        liveBroadcastContent: "none",
        publishTime: "2025-05-08T17:48:23Z",
      },
    },
    // {
    //   kind: "youtube#searchResult",
    //   etag: "3Myxpe_5pew93fHk0yMphEvagMw",
    //   id: {
    //     kind: "youtube#video",
    //     videoId: "nChVr0_Kxus",
    //   },
    //   snippet: {
    //     publishedAt: "2025-05-07T20:31:13Z",
    //     channelId: "UCN0QBfKk0ZSytyX_16M11fA",
    //     title: "Day of Climate at the MIT Museum",
    //     description:
    //       "In April 2025, Day of Climate brought together MIT faculty, educators, learners, and local community members at the MIT Museum ...",
    //     thumbnails: {
    //       default: {
    //         url: "https://i.ytimg.com/vi/nChVr0_Kxus/default.jpg",
    //         width: 120,
    //         height: 90,
    //       },
    //       medium: {
    //         url: "https://i.ytimg.com/vi/nChVr0_Kxus/mqdefault.jpg",
    //         width: 320,
    //         height: 180,
    //       },
    //       high: {
    //         url: "https://i.ytimg.com/vi/nChVr0_Kxus/hqdefault.jpg",
    //         width: 480,
    //         height: 360,
    //       },
    //     },
    //     channelTitle: "MIT Open Learning",
    //     liveBroadcastContent: "none",
    //     publishTime: "2025-05-07T20:31:13Z",
    //   },
    // },
    // {
    //   kind: "youtube#searchResult",
    //   etag: "6q_iX-ocJq7yGtgq4HuqIhFMZkY",
    //   id: {
    //     kind: "youtube#video",
    //     videoId: "n9sjIY06eDs",
    //   },
    //   snippet: {
    //     publishedAt: "2025-05-07T12:45:10Z",
    //     channelId: "UCN0QBfKk0ZSytyX_16M11fA",
    //     title: "Introduction to MIT RAISE",
    //     description:
    //       "Cynthia Breazeal introduces the MIT RAISE Initiative -- Responsible AI for Social Empowerment and Education. RAISE is MIT's ...",
    //     thumbnails: {
    //       default: {
    //         url: "https://i.ytimg.com/vi/n9sjIY06eDs/default.jpg",
    //         width: 120,
    //         height: 90,
    //       },
    //       medium: {
    //         url: "https://i.ytimg.com/vi/n9sjIY06eDs/mqdefault.jpg",
    //         width: 320,
    //         height: 180,
    //       },
    //       high: {
    //         url: "https://i.ytimg.com/vi/n9sjIY06eDs/hqdefault.jpg",
    //         width: 480,
    //         height: 360,
    //       },
    //     },
    //     channelTitle: "MIT Open Learning",
    //     liveBroadcastContent: "none",
    //     publishTime: "2025-05-07T12:45:10Z",
    //   },
    // },
    {
      kind: "youtube#searchResult",
      etag: "qICOfZPyEf3XMQJgazs_Lo3QejQ",
      id: {
        kind: "youtube#video",
        videoId: "pLYzH2V7QNI",
      },
      snippet: {
        publishedAt: "2025-05-06T19:46:40Z",
        channelId: "UCN0QBfKk0ZSytyX_16M11fA",
        title: "Origami, magic, and math",
        description:
          "How does origami work? MIT Professor Erik Demaine explains. Learn more about MIT Open Learning: ...",
        thumbnails: {
          default: {
            url: "https://i.ytimg.com/vi/pLYzH2V7QNI/default.jpg",
            width: 120,
            height: 90,
          },
          medium: {
            url: "https://i.ytimg.com/vi/pLYzH2V7QNI/mqdefault.jpg",
            width: 320,
            height: 180,
          },
          high: {
            url: "https://i.ytimg.com/vi/pLYzH2V7QNI/hqdefault.jpg",
            width: 480,
            height: 360,
          },
        },
        channelTitle: "MIT Open Learning",
        liveBroadcastContent: "none",
        publishTime: "2025-05-06T19:46:40Z",
      },
    },
    {
      kind: "youtube#searchResult",
      etag: "IF7s3XRnfaSlVbKmSlcL2JIXFRw",
      id: {
        kind: "youtube#video",
        videoId: "oLHw43JY_20",
      },
      snippet: {
        publishedAt: "2025-05-01T17:57:56Z",
        channelId: "UCN0QBfKk0ZSytyX_16M11fA",
        title:
          "What is quantum economic advantage? #shorts #quantumcomputers #quantumcomputing",
        description:
          "In quantum computing, what is quantum economic advantage? An MIT research scientist explains. Learn more about MIT Open ...",
        thumbnails: {
          default: {
            url: "https://i.ytimg.com/vi/oLHw43JY_20/default.jpg",
            width: 120,
            height: 90,
          },
          medium: {
            url: "https://i.ytimg.com/vi/oLHw43JY_20/mqdefault.jpg",
            width: 320,
            height: 180,
          },
          high: {
            url: "https://i.ytimg.com/vi/oLHw43JY_20/hqdefault.jpg",
            width: 480,
            height: 360,
          },
        },
        channelTitle: "MIT Open Learning",
        liveBroadcastContent: "none",
        publishTime: "2025-05-01T17:57:56Z",
      },
    },
    {
      kind: "youtube#searchResult",
      etag: "AWqiVWRYnc-d1kcSmSDtRymEw9Q",
      id: {
        kind: "youtube#video",
        videoId: "2FrEp9He6lw",
      },
      snippet: {
        publishedAt: "2025-04-29T14:34:37Z",
        channelId: "UCN0QBfKk0ZSytyX_16M11fA",
        title:
          "This hands-on kit brings climate science to life #shorts #science #climate",
        description:
          "The Coastal Climate Science Activities and Experiments tool helps students connect carbon dioxide in the atmosphere to rising ...",
        thumbnails: {
          default: {
            url: "https://i.ytimg.com/vi/2FrEp9He6lw/default.jpg",
            width: 120,
            height: 90,
          },
          medium: {
            url: "https://i.ytimg.com/vi/2FrEp9He6lw/mqdefault.jpg",
            width: 320,
            height: 180,
          },
          high: {
            url: "https://i.ytimg.com/vi/2FrEp9He6lw/hqdefault.jpg",
            width: 480,
            height: 360,
          },
        },
        channelTitle: "MIT Open Learning",
        liveBroadcastContent: "none",
        publishTime: "2025-04-29T14:34:37Z",
      },
    },
    {
      kind: "youtube#searchResult",
      etag: "AbBlObc2e8QfGRjoVkw2H5QeOyo",
      id: {
        kind: "youtube#video",
        videoId: "JjAqAdHVh4E",
      },
      snippet: {
        publishedAt: "2025-04-24T13:28:23Z",
        channelId: "UCN0QBfKk0ZSytyX_16M11fA",
        title: "MIT Baker House Piano Drop #shorts #mit",
        description:
          "Throwback to the 2010 MIT Baker House Piano Drop. In a long-standing tradition, students drop a piano off the roof to mark “Drop ...",
        thumbnails: {
          default: {
            url: "https://i.ytimg.com/vi/JjAqAdHVh4E/default.jpg",
            width: 120,
            height: 90,
          },
          medium: {
            url: "https://i.ytimg.com/vi/JjAqAdHVh4E/mqdefault.jpg",
            width: 320,
            height: 180,
          },
          high: {
            url: "https://i.ytimg.com/vi/JjAqAdHVh4E/hqdefault.jpg",
            width: 480,
            height: 360,
          },
        },
        channelTitle: "MIT Open Learning",
        liveBroadcastContent: "none",
        publishTime: "2025-04-24T13:28:23Z",
      },
    },
    {
      kind: "youtube#searchResult",
      etag: "CMzlPFhNES7jXJsBNxuiBE0CpPc",
      id: {
        kind: "youtube#video",
        videoId: "QK_0UVYfBY4",
      },
      snippet: {
        publishedAt: "2025-04-22T18:23:32Z",
        channelId: "UCN0QBfKk0ZSytyX_16M11fA",
        title:
          "How can we make nuclear fuel safer? #shorts #science #nuclearpower #nuclear #nuclearscience",
        description:
          "MIT Professor Michael Short explains how we can make nuclear fuel safer. Want to learn more? Visit https://openlearning.mit.edu/.",
        thumbnails: {
          default: {
            url: "https://i.ytimg.com/vi/QK_0UVYfBY4/default.jpg",
            width: 120,
            height: 90,
          },
          medium: {
            url: "https://i.ytimg.com/vi/QK_0UVYfBY4/mqdefault.jpg",
            width: 320,
            height: 180,
          },
          high: {
            url: "https://i.ytimg.com/vi/QK_0UVYfBY4/hqdefault.jpg",
            width: 480,
            height: 360,
          },
        },
        channelTitle: "MIT Open Learning",
        liveBroadcastContent: "none",
        publishTime: "2025-04-22T18:23:32Z",
      },
    },
    {
      kind: "youtube#searchResult",
      etag: "zwR2-m15_7gSEJ6nQybb2lypAvg",
      id: {
        kind: "youtube#video",
        videoId: "16Hds6OqqzI",
      },
      snippet: {
        publishedAt: "2025-04-17T17:40:41Z",
        channelId: "UCN0QBfKk0ZSytyX_16M11fA",
        title:
          "Stephen Hawking on the speed of communication #shorts #BaudRate  #AssistiveTechnology",
        description:
          "In September 1994, Stephen Hawking spoke at MIT's Forum on Education and Technology. Watch the full video: ...",
        thumbnails: {
          default: {
            url: "https://i.ytimg.com/vi/16Hds6OqqzI/default.jpg",
            width: 120,
            height: 90,
          },
          medium: {
            url: "https://i.ytimg.com/vi/16Hds6OqqzI/mqdefault.jpg",
            width: 320,
            height: 180,
          },
          high: {
            url: "https://i.ytimg.com/vi/16Hds6OqqzI/hqdefault.jpg",
            width: 480,
            height: 360,
          },
        },
        channelTitle: "MIT Open Learning",
        liveBroadcastContent: "none",
        publishTime: "2025-04-17T17:40:41Z",
      },
    },
    {
      kind: "youtube#searchResult",
      etag: "rsVvuPzreB6mXuNGMe-sPYRLQMA",
      id: {
        kind: "youtube#video",
        videoId: "NJGJwJmBt4s",
      },
      snippet: {
        publishedAt: "2025-04-15T13:24:33Z",
        channelId: "UCN0QBfKk0ZSytyX_16M11fA",
        title:
          "How does water remember what happens to it? #shorts #climate #climateaction #climatechange",
        description:
          "Did you know water has a memory? Watch this video to learn how climate change affects life below the surface. Learn more about ...",
        thumbnails: {
          default: {
            url: "https://i.ytimg.com/vi/NJGJwJmBt4s/default.jpg",
            width: 120,
            height: 90,
          },
          medium: {
            url: "https://i.ytimg.com/vi/NJGJwJmBt4s/mqdefault.jpg",
            width: 320,
            height: 180,
          },
          high: {
            url: "https://i.ytimg.com/vi/NJGJwJmBt4s/hqdefault.jpg",
            width: 480,
            height: 360,
          },
        },
        channelTitle: "MIT Open Learning",
        liveBroadcastContent: "none",
        publishTime: "2025-04-15T13:24:33Z",
      },
    },
    {
      kind: "youtube#searchResult",
      etag: "SMbGg4XRH5qmfLN6Ij2iDe8r9pw",
      id: {
        kind: "youtube#video",
        videoId: "mCqc_x7Kan8",
      },
      snippet: {
        publishedAt: "2025-04-09T18:10:44Z",
        channelId: "UCN0QBfKk0ZSytyX_16M11fA",
        title:
          "Steve Jobs on working with people - Speaking at MIT, 1992 #shorts #leadership #ProblemSolving",
        description:
          "Steve Jobs, one of the computer industry's foremost entrepreneurs, gives a wide-ranging talk to a group of MIT Sloan School of ...",
        thumbnails: {
          default: {
            url: "https://i.ytimg.com/vi/mCqc_x7Kan8/default.jpg",
            width: 120,
            height: 90,
          },
          medium: {
            url: "https://i.ytimg.com/vi/mCqc_x7Kan8/mqdefault.jpg",
            width: 320,
            height: 180,
          },
          high: {
            url: "https://i.ytimg.com/vi/mCqc_x7Kan8/hqdefault.jpg",
            width: 480,
            height: 360,
          },
        },
        channelTitle: "MIT Open Learning",
        liveBroadcastContent: "none",
        publishTime: "2025-04-09T18:10:44Z",
      },
    },
    {
      kind: "youtube#searchResult",
      etag: "INRQ-TuHB2FLmN-fD0OhJrwbfDg",
      id: {
        kind: "youtube#video",
        videoId: "o5JZDhP4nXA",
      },
      snippet: {
        publishedAt: "2025-04-03T13:38:07Z",
        channelId: "UCN0QBfKk0ZSytyX_16M11fA",
        title:
          "How do systems create emergence? #shorts #stem #systems #systemarchitecture",
        description:
          "What is a system, and how do systems create emergence? Bruce Cameron, director of the MIT System Architecture Group, ...",
        thumbnails: {
          default: {
            url: "https://i.ytimg.com/vi/o5JZDhP4nXA/default.jpg",
            width: 120,
            height: 90,
          },
          medium: {
            url: "https://i.ytimg.com/vi/o5JZDhP4nXA/mqdefault.jpg",
            width: 320,
            height: 180,
          },
          high: {
            url: "https://i.ytimg.com/vi/o5JZDhP4nXA/hqdefault.jpg",
            width: 480,
            height: 360,
          },
        },
        channelTitle: "MIT Open Learning",
        liveBroadcastContent: "none",
        publishTime: "2025-04-03T13:38:07Z",
      },
    },
    // {
    //   kind: "youtube#searchResult",
    //   etag: "QbTxI_cM3_w6seRaD8B5ojYfcsE",
    //   id: {
    //     kind: "youtube#video",
    //     videoId: "IpzNB-6i7Ro",
    //   },
    //   snippet: {
    //     publishedAt: "2025-04-01T14:07:30Z",
    //     channelId: "UCN0QBfKk0ZSytyX_16M11fA",
    //     title: "Let&#39;s play climate charades #education #teaching #shorts",
    //     description:
    //       "How can teachers help students understand a complex topic like climate change? Day of Climate offers a free, hands-on ...",
    //     thumbnails: {
    //       default: {
    //         url: "https://i.ytimg.com/vi/IpzNB-6i7Ro/default.jpg",
    //         width: 120,
    //         height: 90,
    //       },
    //       medium: {
    //         url: "https://i.ytimg.com/vi/IpzNB-6i7Ro/mqdefault.jpg",
    //         width: 320,
    //         height: 180,
    //       },
    //       high: {
    //         url: "https://i.ytimg.com/vi/IpzNB-6i7Ro/hqdefault.jpg",
    //         width: 480,
    //         height: 360,
    //       },
    //     },
    //     channelTitle: "MIT Open Learning",
    //     liveBroadcastContent: "none",
    //     publishTime: "2025-04-01T14:07:30Z",
    //   },
    // },
    // {
    //   kind: "youtube#searchResult",
    //   etag: "f9RPSwLVnHdF4Nwvkm7JrQ5bnJM",
    //   id: {
    //     kind: "youtube#video",
    //     videoId: "Uh3QEh1ZWjw",
    //   },
    //   snippet: {
    //     publishedAt: "2025-03-27T16:14:29Z",
    //     channelId: "UCN0QBfKk0ZSytyX_16M11fA",
    //     title:
    //       "How do we experience culture? #shorts #culture #culturalinfluences #culturalexperience",
    //     description:
    //       "Explore the fascinating world of cultural experiences! MIT Senior Lecturer David Niño explains how we are shaped by cultures, ...",
    //     thumbnails: {
    //       default: {
    //         url: "https://i.ytimg.com/vi/Uh3QEh1ZWjw/default.jpg",
    //         width: 120,
    //         height: 90,
    //       },
    //       medium: {
    //         url: "https://i.ytimg.com/vi/Uh3QEh1ZWjw/mqdefault.jpg",
    //         width: 320,
    //         height: 180,
    //       },
    //       high: {
    //         url: "https://i.ytimg.com/vi/Uh3QEh1ZWjw/hqdefault.jpg",
    //         width: 480,
    //         height: 360,
    //       },
    //     },
    //     channelTitle: "MIT Open Learning",
    //     liveBroadcastContent: "none",
    //     publishTime: "2025-03-27T16:14:29Z",
    //   },
    // },
    // {
    //   kind: "youtube#searchResult",
    //   etag: "5VBrLyHIdtalj0eS4OWvmXWXbaY",
    //   id: {
    //     kind: "youtube#video",
    //     videoId: "COc0LU7Ejp4",
    //   },
    //   snippet: {
    //     publishedAt: "2025-03-26T13:22:10Z",
    //     channelId: "UCN0QBfKk0ZSytyX_16M11fA",
    //     title: "Introduction to Day of Climate at MIT",
    //     description:
    //       "Day of Climate is a broad new initiative dedicated to equipping K-12 learners and educators with the tools and knowledge to ...",
    //     thumbnails: {
    //       default: {
    //         url: "https://i.ytimg.com/vi/COc0LU7Ejp4/default.jpg",
    //         width: 120,
    //         height: 90,
    //       },
    //       medium: {
    //         url: "https://i.ytimg.com/vi/COc0LU7Ejp4/mqdefault.jpg",
    //         width: 320,
    //         height: 180,
    //       },
    //       high: {
    //         url: "https://i.ytimg.com/vi/COc0LU7Ejp4/hqdefault.jpg",
    //         width: 480,
    //         height: 360,
    //       },
    //     },
    //     channelTitle: "MIT Open Learning",
    //     liveBroadcastContent: "none",
    //     publishTime: "2025-03-26T13:22:10Z",
    //   },
    // },
    // {
    //   kind: "youtube#searchResult",
    //   etag: "V9GnyGYEDa0UToRPNTA00s-u2gA",
    //   id: {
    //     kind: "youtube#video",
    //     videoId: "lE61WCdz2Nk",
    //   },
    //   snippet: {
    //     publishedAt: "2025-03-25T17:34:07Z",
    //     channelId: "UCN0QBfKk0ZSytyX_16M11fA",
    //     title:
    //       "Can we engineer our bodies to need less oxygen? #science #scienceexplained #biology #stemeducation",
    //     description:
    //       "An MIT biologist breaks down whether we could engineer our bodies to need less oxygen. Learn more about MIT Open Learning: ...",
    //     thumbnails: {
    //       default: {
    //         url: "https://i.ytimg.com/vi/lE61WCdz2Nk/default.jpg",
    //         width: 120,
    //         height: 90,
    //       },
    //       medium: {
    //         url: "https://i.ytimg.com/vi/lE61WCdz2Nk/mqdefault.jpg",
    //         width: 320,
    //         height: 180,
    //       },
    //       high: {
    //         url: "https://i.ytimg.com/vi/lE61WCdz2Nk/hqdefault.jpg",
    //         width: 480,
    //         height: 360,
    //       },
    //     },
    //     channelTitle: "MIT Open Learning",
    //     liveBroadcastContent: "none",
    //     publishTime: "2025-03-25T17:34:07Z",
    //   },
    // },
    // {
    //   kind: "youtube#searchResult",
    //   etag: "1ZImUvM62SgzZe3L4KfDxDVeAFI",
    //   id: {
    //     kind: "youtube#video",
    //     videoId: "YH_thxgum8g",
    //   },
    //   snippet: {
    //     publishedAt: "2025-03-20T18:06:44Z",
    //     channelId: "UCN0QBfKk0ZSytyX_16M11fA",
    //     title:
    //       "Visit MIT&#39;s nuclear reactor #shorts #nuclearreactors #science #research",
    //     description:
    //       "Take a virtual tour of MIT's nuclear reactor! Learn more about MIT Open Learning: https://openlearning.mit.edu/",
    //     thumbnails: {
    //       default: {
    //         url: "https://i.ytimg.com/vi/YH_thxgum8g/default.jpg",
    //         width: 120,
    //         height: 90,
    //       },
    //       medium: {
    //         url: "https://i.ytimg.com/vi/YH_thxgum8g/mqdefault.jpg",
    //         width: 320,
    //         height: 180,
    //       },
    //       high: {
    //         url: "https://i.ytimg.com/vi/YH_thxgum8g/hqdefault.jpg",
    //         width: 480,
    //         height: 360,
    //       },
    //     },
    //     channelTitle: "MIT Open Learning",
    //     liveBroadcastContent: "none",
    //     publishTime: "2025-03-20T18:06:44Z",
    //   },
    // },
    // {
    //   kind: "youtube#searchResult",
    //   etag: "MVjITDD_ZThdvOpJDsXeX_hyFF0",
    //   id: {
    //     kind: "youtube#video",
    //     videoId: "XW2wuAwQqJ0",
    //   },
    //   snippet: {
    //     publishedAt: "2025-03-18T14:49:58Z",
    //     channelId: "UCN0QBfKk0ZSytyX_16M11fA",
    //     title:
    //       "How does computer vision work? #shorts #computervision #computerscience #ai #artificialintelligence",
    //     description:
    //       "Ever wondered how computer vision works? MIT Professor Antonio Torralba explains. Learn more about MIT Open Learning: ...",
    //     thumbnails: {
    //       default: {
    //         url: "https://i.ytimg.com/vi/XW2wuAwQqJ0/default.jpg",
    //         width: 120,
    //         height: 90,
    //       },
    //       medium: {
    //         url: "https://i.ytimg.com/vi/XW2wuAwQqJ0/mqdefault.jpg",
    //         width: 320,
    //         height: 180,
    //       },
    //       high: {
    //         url: "https://i.ytimg.com/vi/XW2wuAwQqJ0/hqdefault.jpg",
    //         width: 480,
    //         height: 360,
    //       },
    //     },
    //     channelTitle: "MIT Open Learning",
    //     liveBroadcastContent: "none",
    //     publishTime: "2025-03-18T14:49:58Z",
    //   },
    // },
    // {
    //   kind: "youtube#searchResult",
    //   etag: "r-DutB8mi7VhFeVUDbVnMuRw0J0",
    //   id: {
    //     kind: "youtube#video",
    //     videoId: "c8udXWpIMSs",
    //   },
    //   snippet: {
    //     publishedAt: "2025-03-14T16:39:36Z",
    //     channelId: "UCN0QBfKk0ZSytyX_16M11fA",
    //     title:
    //       "The origins of quantum computing #shorts #quantumcomputing #quantumcomputers #artificialintelligence",
    //     description:
    //       "Back in 1994, MIT Prof. Peter Shor's algorithm cracked the code on how quantum computers could factor large numbers.",
    //     thumbnails: {
    //       default: {
    //         url: "https://i.ytimg.com/vi/c8udXWpIMSs/default.jpg",
    //         width: 120,
    //         height: 90,
    //       },
    //       medium: {
    //         url: "https://i.ytimg.com/vi/c8udXWpIMSs/mqdefault.jpg",
    //         width: 320,
    //         height: 180,
    //       },
    //       high: {
    //         url: "https://i.ytimg.com/vi/c8udXWpIMSs/hqdefault.jpg",
    //         width: 480,
    //         height: 360,
    //       },
    //     },
    //     channelTitle: "MIT Open Learning",
    //     liveBroadcastContent: "none",
    //     publishTime: "2025-03-14T16:39:36Z",
    //   },
    // },
    // {
    //   kind: "youtube#searchResult",
    //   etag: "-mdQQgc7O77Yh8gbgBfxfE0NnzQ",
    //   id: {
    //     kind: "youtube#video",
    //     videoId: "8fjnQXMVANc",
    //   },
    //   snippet: {
    //     publishedAt: "2025-03-13T04:00:12Z",
    //     channelId: "UCN0QBfKk0ZSytyX_16M11fA",
    //     title:
    //       "The annual MITgiving day begins now! #shorts #GiveBack #free #education #educationalresources",
    //     description:
    //       "MIT 24-Hour Challenge (giving.mit.edu/24hc-openlearning), MIT's annual giving day begins now. We hope you can show your ...",
    //     thumbnails: {
    //       default: {
    //         url: "https://i.ytimg.com/vi/8fjnQXMVANc/default.jpg",
    //         width: 120,
    //         height: 90,
    //       },
    //       medium: {
    //         url: "https://i.ytimg.com/vi/8fjnQXMVANc/mqdefault.jpg",
    //         width: 320,
    //         height: 180,
    //       },
    //       high: {
    //         url: "https://i.ytimg.com/vi/8fjnQXMVANc/hqdefault.jpg",
    //         width: 480,
    //         height: 360,
    //       },
    //     },
    //     channelTitle: "MIT Open Learning",
    //     liveBroadcastContent: "none",
    //     publishTime: "2025-03-13T04:00:12Z",
    //   },
    // },
    // {
    //   kind: "youtube#searchResult",
    //   etag: "d9ZdWdCSxUOjGtHJWn4_Und0yvE",
    //   id: {
    //     kind: "youtube#video",
    //     videoId: "BTsRhtPcl6o",
    //   },
    //   snippet: {
    //     publishedAt: "2025-03-11T15:54:09Z",
    //     channelId: "UCN0QBfKk0ZSytyX_16M11fA",
    //     title:
    //       "How do you make a unicorn? #shorts #science #biology #genome #genomesequencing",
    //     description:
    //       "Biologist Sera Thornton explains how to make a unicorn. Learn more about MIT Open Learning: https://openlearning.mit.edu/",
    //     thumbnails: {
    //       default: {
    //         url: "https://i.ytimg.com/vi/BTsRhtPcl6o/default.jpg",
    //         width: 120,
    //         height: 90,
    //       },
    //       medium: {
    //         url: "https://i.ytimg.com/vi/BTsRhtPcl6o/mqdefault.jpg",
    //         width: 320,
    //         height: 180,
    //       },
    //       high: {
    //         url: "https://i.ytimg.com/vi/BTsRhtPcl6o/hqdefault.jpg",
    //         width: 480,
    //         height: 360,
    //       },
    //     },
    //     channelTitle: "MIT Open Learning",
    //     liveBroadcastContent: "none",
    //     publishTime: "2025-03-11T15:54:09Z",
    //   },
    // },
    // {
    //   kind: "youtube#searchResult",
    //   etag: "Sx8_XMk9sP2UfzskKExGDDp-Rqo",
    //   id: {
    //     kind: "youtube#video",
    //     videoId: "ERN2kZJe2rg",
    //   },
    //   snippet: {
    //     publishedAt: "2025-03-08T05:00:14Z",
    //     channelId: "UCN0QBfKk0ZSytyX_16M11fA",
    //     title:
    //       "Twenty, twenty, 24 hours to give…I wanna be educated  #MIT #MITx #MITOCW #OER #OnlineLearning #free",
    //     description:
    //       "On any given day, MIT Open Learning, @mitocw , @MITxVideos are sharing MIT's teaching and learning resources with the ...",
    //     thumbnails: {
    //       default: {
    //         url: "https://i.ytimg.com/vi/ERN2kZJe2rg/default.jpg",
    //         width: 120,
    //         height: 90,
    //       },
    //       medium: {
    //         url: "https://i.ytimg.com/vi/ERN2kZJe2rg/mqdefault.jpg",
    //         width: 320,
    //         height: 180,
    //       },
    //       high: {
    //         url: "https://i.ytimg.com/vi/ERN2kZJe2rg/hqdefault.jpg",
    //         width: 480,
    //         height: 360,
    //       },
    //     },
    //     channelTitle: "MIT Open Learning",
    //     liveBroadcastContent: "none",
    //     publishTime: "2025-03-08T05:00:14Z",
    //   },
    // },
    // {
    //   kind: "youtube#searchResult",
    //   etag: "KlRNm2X3yDUgG09-6WFvhsA0Zr0",
    //   id: {
    //     kind: "youtube#video",
    //     videoId: "RZL5sujoz1w",
    //   },
    //   snippet: {
    //     publishedAt: "2025-03-07T15:18:01Z",
    //     channelId: "UCN0QBfKk0ZSytyX_16M11fA",
    //     title:
    //       "Is it true we only use a tiny part of our brains? #shorts #neuroscience",
    //     description:
    //       "Myth busted: Have you ever heard that humans only use 10% of our brainpower on an average day? Discover what's really ...",
    //     thumbnails: {
    //       default: {
    //         url: "https://i.ytimg.com/vi/RZL5sujoz1w/default.jpg",
    //         width: 120,
    //         height: 90,
    //       },
    //       medium: {
    //         url: "https://i.ytimg.com/vi/RZL5sujoz1w/mqdefault.jpg",
    //         width: 320,
    //         height: 180,
    //       },
    //       high: {
    //         url: "https://i.ytimg.com/vi/RZL5sujoz1w/hqdefault.jpg",
    //         width: 480,
    //         height: 360,
    //       },
    //     },
    //     channelTitle: "MIT Open Learning",
    //     liveBroadcastContent: "none",
    //     publishTime: "2025-03-07T15:18:01Z",
    //   },
    // },
    // {
    //   kind: "youtube#searchResult",
    //   etag: "QjhSLe8V2grSknY7RE3sETHl7Fw",
    //   id: {
    //     kind: "youtube#video",
    //     videoId: "IZcjDphVNbw",
    //   },
    //   snippet: {
    //     publishedAt: "2025-03-06T05:00:13Z",
    //     channelId: "UCN0QBfKk0ZSytyX_16M11fA",
    //     title: "Twenty, twenty, 24 hours to give…I wanna be educated",
    //     description:
    //       "On any given day, MIT Open Learning, MITx, and MIT OpenCourseWare are sharing MIT's teaching and learning resources with ...",
    //     thumbnails: {
    //       default: {
    //         url: "https://i.ytimg.com/vi/IZcjDphVNbw/default.jpg",
    //         width: 120,
    //         height: 90,
    //       },
    //       medium: {
    //         url: "https://i.ytimg.com/vi/IZcjDphVNbw/mqdefault.jpg",
    //         width: 320,
    //         height: 180,
    //       },
    //       high: {
    //         url: "https://i.ytimg.com/vi/IZcjDphVNbw/hqdefault.jpg",
    //         width: 480,
    //         height: 360,
    //       },
    //     },
    //     channelTitle: "MIT Open Learning",
    //     liveBroadcastContent: "none",
    //     publishTime: "2025-03-06T05:00:13Z",
    //   },
    // },
    // {
    //   kind: "youtube#searchResult",
    //   etag: "TTy5b2Y4e4JZ3Zu2pUqmfMCoVX0",
    //   id: {
    //     kind: "youtube#video",
    //     videoId: "EfcFOsmq4Y4",
    //   },
    //   snippet: {
    //     publishedAt: "2025-03-04T14:44:18Z",
    //     channelId: "UCN0QBfKk0ZSytyX_16M11fA",
    //     title:
    //       "Why&#39;s chemistry &quot;the science of the familiar?&quot; #shorts #chemistry #scienceinaction #scienceinaminute",
    //     description:
    //       "A snapshot of a lecture in MIT's Chemistry Behind the Magic, which features videos of exciting live chemistry demonstrations.",
    //     thumbnails: {
    //       default: {
    //         url: "https://i.ytimg.com/vi/EfcFOsmq4Y4/default.jpg",
    //         width: 120,
    //         height: 90,
    //       },
    //       medium: {
    //         url: "https://i.ytimg.com/vi/EfcFOsmq4Y4/mqdefault.jpg",
    //         width: 320,
    //         height: 180,
    //       },
    //       high: {
    //         url: "https://i.ytimg.com/vi/EfcFOsmq4Y4/hqdefault.jpg",
    //         width: 480,
    //         height: 360,
    //       },
    //     },
    //     channelTitle: "MIT Open Learning",
    //     liveBroadcastContent: "none",
    //     publishTime: "2025-03-04T14:44:18Z",
    //   },
    // },
    // {
    //   kind: "youtube#searchResult",
    //   etag: "msTEhJmPByk7_7K68pFEiv7kOnQ",
    //   id: {
    //     kind: "youtube#video",
    //     videoId: "b6_dYXRPxPs",
    //   },
    //   snippet: {
    //     publishedAt: "2025-02-27T17:20:44Z",
    //     channelId: "UCN0QBfKk0ZSytyX_16M11fA",
    //     title:
    //       "When your brain plays tricks on your perception #shorts #science #chemistry #scienceinaction",
    //     description:
    //       "A snapshot of a lecture in MIT's Chemistry Behind the Magic, which features videos of exciting live chemistry demonstrations.",
    //     thumbnails: {
    //       default: {
    //         url: "https://i.ytimg.com/vi/b6_dYXRPxPs/default.jpg",
    //         width: 120,
    //         height: 90,
    //       },
    //       medium: {
    //         url: "https://i.ytimg.com/vi/b6_dYXRPxPs/mqdefault.jpg",
    //         width: 320,
    //         height: 180,
    //       },
    //       high: {
    //         url: "https://i.ytimg.com/vi/b6_dYXRPxPs/hqdefault.jpg",
    //         width: 480,
    //         height: 360,
    //       },
    //     },
    //     channelTitle: "MIT Open Learning",
    //     liveBroadcastContent: "none",
    //     publishTime: "2025-02-27T17:20:44Z",
    //   },
    // },
    // {
    //   kind: "youtube#searchResult",
    //   etag: "-wzKyZ0xNrlsjB38LCbW5ha_dwI",
    //   id: {
    //     kind: "youtube#video",
    //     videoId: "_SpVuugsVNg",
    //   },
    //   snippet: {
    //     publishedAt: "2025-02-25T18:15:52Z",
    //     channelId: "UCN0QBfKk0ZSytyX_16M11fA",
    //     title:
    //       "Science is fun! #shorts #science #scienceinaction #scienceinaminute #sciencexperiment #chemistry",
    //     description:
    //       "A snapshot of MIT's Chemistry Behind the Magic, which features videos of exciting live chemistry demonstrations.",
    //     thumbnails: {
    //       default: {
    //         url: "https://i.ytimg.com/vi/_SpVuugsVNg/default.jpg",
    //         width: 120,
    //         height: 90,
    //       },
    //       medium: {
    //         url: "https://i.ytimg.com/vi/_SpVuugsVNg/mqdefault.jpg",
    //         width: 320,
    //         height: 180,
    //       },
    //       high: {
    //         url: "https://i.ytimg.com/vi/_SpVuugsVNg/hqdefault.jpg",
    //         width: 480,
    //         height: 360,
    //       },
    //     },
    //     channelTitle: "MIT Open Learning",
    //     liveBroadcastContent: "none",
    //     publishTime: "2025-02-25T18:15:52Z",
    //   },
    // },
    // {
    //   kind: "youtube#searchResult",
    //   etag: "imyt8lYgifnH1WSj9o0AeWqn6X8",
    //   id: {
    //     kind: "youtube#video",
    //     videoId: "KQuXHCNpHMY",
    //   },
    //   snippet: {
    //     publishedAt: "2025-02-20T15:03:19Z",
    //     channelId: "UCN0QBfKk0ZSytyX_16M11fA",
    //     title:
    //       "What is Nuclear Magnetic Resonance (NMR)? #shorts #science #scienceinaminute #scienceinaction",
    //     description:
    //       "How do scientists figure out what a molecule looks like? They use Nuclear Magnetic Resonance (NMR) to identify unknown ...",
    //     thumbnails: {
    //       default: {
    //         url: "https://i.ytimg.com/vi/KQuXHCNpHMY/default.jpg",
    //         width: 120,
    //         height: 90,
    //       },
    //       medium: {
    //         url: "https://i.ytimg.com/vi/KQuXHCNpHMY/mqdefault.jpg",
    //         width: 320,
    //         height: 180,
    //       },
    //       high: {
    //         url: "https://i.ytimg.com/vi/KQuXHCNpHMY/hqdefault.jpg",
    //         width: 480,
    //         height: 360,
    //       },
    //     },
    //     channelTitle: "MIT Open Learning",
    //     liveBroadcastContent: "none",
    //     publishTime: "2025-02-20T15:03:19Z",
    //   },
    // },
    // {
    //   kind: "youtube#searchResult",
    //   etag: "AAC6dYBQvJ_HwiLKmpLAkinhEH8",
    //   id: {
    //     kind: "youtube#video",
    //     videoId: "wgGEmByqRCU",
    //   },
    //   snippet: {
    //     publishedAt: "2025-02-18T16:06:11Z",
    //     channelId: "UCN0QBfKk0ZSytyX_16M11fA",
    //     title:
    //       "Checking out MIT&#39;s ChemLab Bootcamp #shorts #chemlab #chemistry #lablife #science",
    //     description:
    //       "Want to crush it in MIT's ChemLab Bootcamp? Keep these tips in mind. More information about MIT Open Learning: ...",
    //     thumbnails: {
    //       default: {
    //         url: "https://i.ytimg.com/vi/wgGEmByqRCU/default.jpg",
    //         width: 120,
    //         height: 90,
    //       },
    //       medium: {
    //         url: "https://i.ytimg.com/vi/wgGEmByqRCU/mqdefault.jpg",
    //         width: 320,
    //         height: 180,
    //       },
    //       high: {
    //         url: "https://i.ytimg.com/vi/wgGEmByqRCU/hqdefault.jpg",
    //         width: 480,
    //         height: 360,
    //       },
    //     },
    //     channelTitle: "MIT Open Learning",
    //     liveBroadcastContent: "none",
    //     publishTime: "2025-02-18T16:06:11Z",
    //   },
    // },
    // {
    //   kind: "youtube#searchResult",
    //   etag: "JlthPa4wer_lXQCXiEMBiTo9XzE",
    //   id: {
    //     kind: "youtube#video",
    //     videoId: "BUxNV_6RJKA",
    //   },
    //   snippet: {
    //     publishedAt: "2025-02-13T19:24:41Z",
    //     channelId: "UCN0QBfKk0ZSytyX_16M11fA",
    //     title:
    //       "How do generative AI models create images? #shorts #generativeai #aiart #ai",
    //     description:
    //       "MIT's Phillip Isola breaks down how generative AI models turn words into images and how they decide which image to generate ...",
    //     thumbnails: {
    //       default: {
    //         url: "https://i.ytimg.com/vi/BUxNV_6RJKA/default.jpg",
    //         width: 120,
    //         height: 90,
    //       },
    //       medium: {
    //         url: "https://i.ytimg.com/vi/BUxNV_6RJKA/mqdefault.jpg",
    //         width: 320,
    //         height: 180,
    //       },
    //       high: {
    //         url: "https://i.ytimg.com/vi/BUxNV_6RJKA/hqdefault.jpg",
    //         width: 480,
    //         height: 360,
    //       },
    //     },
    //     channelTitle: "MIT Open Learning",
    //     liveBroadcastContent: "none",
    //     publishTime: "2025-02-13T19:24:41Z",
    //   },
    // },
    // {
    //   kind: "youtube#searchResult",
    //   etag: "2qu6EfbKcPhlbeZp0Ai7xFklpkk",
    //   id: {
    //     kind: "youtube#video",
    //     videoId: "GKqdN2RLc-8",
    //   },
    //   snippet: {
    //     publishedAt: "2025-02-11T14:35:58Z",
    //     channelId: "UCN0QBfKk0ZSytyX_16M11fA",
    //     title:
    //       "The physics of skydiving #shorts #physics #skydiving #mit  #physicsinaction",
    //     description:
    //       "There's a lot more to skydiving than just jumping out of a plane and pulling a ripcord. Here, we explain the physics of skydiving.",
    //     thumbnails: {
    //       default: {
    //         url: "https://i.ytimg.com/vi/GKqdN2RLc-8/default.jpg",
    //         width: 120,
    //         height: 90,
    //       },
    //       medium: {
    //         url: "https://i.ytimg.com/vi/GKqdN2RLc-8/mqdefault.jpg",
    //         width: 320,
    //         height: 180,
    //       },
    //       high: {
    //         url: "https://i.ytimg.com/vi/GKqdN2RLc-8/hqdefault.jpg",
    //         width: 480,
    //         height: 360,
    //       },
    //     },
    //     channelTitle: "MIT Open Learning",
    //     liveBroadcastContent: "none",
    //     publishTime: "2025-02-11T14:35:58Z",
    //   },
    // },
    // {
    //   kind: "youtube#searchResult",
    //   etag: "IEsfYYuNSBHPJ-wwg3Nr5QCCbYQ",
    //   id: {
    //     kind: "youtube#video",
    //     videoId: "C1YYO7bMbaA",
    //   },
    //   snippet: {
    //     publishedAt: "2025-02-06T15:20:44Z",
    //     channelId: "UCN0QBfKk0ZSytyX_16M11fA",
    //     title:
    //       "Creating simulations with a quantum computer #shorts #quantumcomputing  #quantum #quantumcomputers",
    //     description:
    //       "Take a glimpse into quantum simulations with MIT Professor Will Oliver. More information about MIT Open Learning: ...",
    //     thumbnails: {
    //       default: {
    //         url: "https://i.ytimg.com/vi/C1YYO7bMbaA/default.jpg",
    //         width: 120,
    //         height: 90,
    //       },
    //       medium: {
    //         url: "https://i.ytimg.com/vi/C1YYO7bMbaA/mqdefault.jpg",
    //         width: 320,
    //         height: 180,
    //       },
    //       high: {
    //         url: "https://i.ytimg.com/vi/C1YYO7bMbaA/hqdefault.jpg",
    //         width: 480,
    //         height: 360,
    //       },
    //     },
    //     channelTitle: "MIT Open Learning",
    //     liveBroadcastContent: "none",
    //     publishTime: "2025-02-06T15:20:44Z",
    //   },
    // },
    // {
    //   kind: "youtube#searchResult",
    //   etag: "TOoTpV8La593cfYk6T4_EMijI48",
    //   id: {
    //     kind: "youtube#video",
    //     videoId: "-fOIVvGKLFU",
    //   },
    //   snippet: {
    //     publishedAt: "2025-02-06T00:09:48Z",
    //     channelId: "UCN0QBfKk0ZSytyX_16M11fA",
    //     title:
    //       "Don&#39;t get dragged by your supply chain #shorts #supplyanddemand #supplychainmanagement",
    //     description:
    //       "Dive into demand planning with this MIT Moments video. Learn more about MIT Open Learning: https://openlearning.mit.edu/",
    //     thumbnails: {
    //       default: {
    //         url: "https://i.ytimg.com/vi/-fOIVvGKLFU/default.jpg",
    //         width: 120,
    //         height: 90,
    //       },
    //       medium: {
    //         url: "https://i.ytimg.com/vi/-fOIVvGKLFU/mqdefault.jpg",
    //         width: 320,
    //         height: 180,
    //       },
    //       high: {
    //         url: "https://i.ytimg.com/vi/-fOIVvGKLFU/hqdefault.jpg",
    //         width: 480,
    //         height: 360,
    //       },
    //     },
    //     channelTitle: "MIT Open Learning",
    //     liveBroadcastContent: "none",
    //     publishTime: "2025-02-06T00:09:48Z",
    //   },
    // },
    // {
    //   kind: "youtube#searchResult",
    //   etag: "0unKAgzGYpv4NQIYO59JlGiONI8",
    //   id: {
    //     kind: "youtube#video",
    //     videoId: "uv-XxknbIrU",
    //   },
    //   snippet: {
    //     publishedAt: "2025-02-04T14:42:20Z",
    //     channelId: "UCN0QBfKk0ZSytyX_16M11fA",
    //     title:
    //       "How do rocket engines work? #shorts #science #aeronautics #astronautics #rocket",
    //     description:
    //       "MIT Professor and Astronaut Jeff Hoffman uses a skateboard and handheld weights to demonstrate how rocket systems work.",
    //     thumbnails: {
    //       default: {
    //         url: "https://i.ytimg.com/vi/uv-XxknbIrU/default.jpg",
    //         width: 120,
    //         height: 90,
    //       },
    //       medium: {
    //         url: "https://i.ytimg.com/vi/uv-XxknbIrU/mqdefault.jpg",
    //         width: 320,
    //         height: 180,
    //       },
    //       high: {
    //         url: "https://i.ytimg.com/vi/uv-XxknbIrU/hqdefault.jpg",
    //         width: 480,
    //         height: 360,
    //       },
    //     },
    //     channelTitle: "MIT Open Learning",
    //     liveBroadcastContent: "none",
    //     publishTime: "2025-02-04T14:42:20Z",
    //   },
    // },
    // {
    //   kind: "youtube#searchResult",
    //   etag: "Ppb0n4htPBFsiQEsuStGVrH8hn8",
    //   id: {
    //     kind: "youtube#video",
    //     videoId: "IHLxCC5UTZ8",
    //   },
    //   snippet: {
    //     publishedAt: "2025-01-31T16:23:46Z",
    //     channelId: "UCN0QBfKk0ZSytyX_16M11fA",
    //     title:
    //       "Generating 500,000 volts with a Van de Graaff generator #shorts #physicsinaction #physics #science",
    //     description:
    //       "Krishna Rajagopal, MIT's William A. M. Burden Professor of Physics, demonstrates how to get 500000 volts with a Van de Graaff ...",
    //     thumbnails: {
    //       default: {
    //         url: "https://i.ytimg.com/vi/IHLxCC5UTZ8/default.jpg",
    //         width: 120,
    //         height: 90,
    //       },
    //       medium: {
    //         url: "https://i.ytimg.com/vi/IHLxCC5UTZ8/mqdefault.jpg",
    //         width: 320,
    //         height: 180,
    //       },
    //       high: {
    //         url: "https://i.ytimg.com/vi/IHLxCC5UTZ8/hqdefault.jpg",
    //         width: 480,
    //         height: 360,
    //       },
    //     },
    //     channelTitle: "MIT Open Learning",
    //     liveBroadcastContent: "none",
    //     publishTime: "2025-01-31T16:23:46Z",
    //   },
    // },
    // {
    //   kind: "youtube#searchResult",
    //   etag: "JpfiJfLw70qYnTxRQCbRS--xx5g",
    //   id: {
    //     kind: "youtube#video",
    //     videoId: "psU7qaABP0k",
    //   },
    //   snippet: {
    //     publishedAt: "2025-01-30T03:10:00Z",
    //     channelId: "UCN0QBfKk0ZSytyX_16M11fA",
    //     title: "How EdTech startups are leveraging AI for education",
    //     description:
    //       "This is the fourth webinar in the MIT Jameel World Education Lab's AI Innovator Series. This panel explores how entrepreneurial ...",
    //     thumbnails: {
    //       default: {
    //         url: "https://i.ytimg.com/vi/psU7qaABP0k/default.jpg",
    //         width: 120,
    //         height: 90,
    //       },
    //       medium: {
    //         url: "https://i.ytimg.com/vi/psU7qaABP0k/mqdefault.jpg",
    //         width: 320,
    //         height: 180,
    //       },
    //       high: {
    //         url: "https://i.ytimg.com/vi/psU7qaABP0k/hqdefault.jpg",
    //         width: 480,
    //         height: 360,
    //       },
    //     },
    //     channelTitle: "MIT Open Learning",
    //     liveBroadcastContent: "none",
    //     publishTime: "2025-01-30T03:10:00Z",
    //   },
    // },
    // {
    //   kind: "youtube#searchResult",
    //   etag: "YI6veT_9eGdMQ8Qsz3np1p6VX44",
    //   id: {
    //     kind: "youtube#video",
    //     videoId: "ik36No2JdKo",
    //   },
    //   snippet: {
    //     publishedAt: "2025-01-30T03:07:22Z",
    //     channelId: "UCN0QBfKk0ZSytyX_16M11fA",
    //     title: "Applying AI to Education",
    //     description:
    //       "This is the fifth webinar in the MIT Jameel World Education Lab's AI Innovator Series. In this final session, MIT Professor Eric ...",
    //     thumbnails: {
    //       default: {
    //         url: "https://i.ytimg.com/vi/ik36No2JdKo/default.jpg",
    //         width: 120,
    //         height: 90,
    //       },
    //       medium: {
    //         url: "https://i.ytimg.com/vi/ik36No2JdKo/mqdefault.jpg",
    //         width: 320,
    //         height: 180,
    //       },
    //       high: {
    //         url: "https://i.ytimg.com/vi/ik36No2JdKo/hqdefault.jpg",
    //         width: 480,
    //         height: 360,
    //       },
    //     },
    //     channelTitle: "MIT Open Learning",
    //     liveBroadcastContent: "none",
    //     publishTime: "2025-01-30T03:07:22Z",
    //   },
    // },
  ],
}
