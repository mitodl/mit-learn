import { useQuery } from "@tanstack/react-query"

export type VideoShort = {
  id: {
    videoId: string
  }
  snippet: {
    title: string
    thumbnails: {
      high: {
        url: string
        width: number
        height: number
      }
    }
  }
}

export const useVideoShortsList = (enabled: boolean) => {
  return useQuery({
    queryKey: ["youtube_shorts", "list"],
    queryFn: async () => {
      const data = MOCK_DATA
      return data.items
    },
    enabled,
  })
}

/* https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${YOUTUBE_CHANNEL_ID}&type=short&order=date&maxResults=50&key=${YOUTUBE_API_KEY}` */
const MOCK_DATA = {
  kind: "youtube#searchListResponse",
  nextPageToken: "CDIQAA",
  regionCode: "ES",
  pageInfo: {
    totalResults: 383,
    resultsPerPage: 50,
  },
  items: [
    {
      kind: "youtube#searchResult",
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
    {
      kind: "youtube#searchResult",
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
    {
      kind: "youtube#searchResult",
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
    {
      kind: "youtube#searchResult",
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
    {
      kind: "youtube#searchResult",
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
  ],
}
