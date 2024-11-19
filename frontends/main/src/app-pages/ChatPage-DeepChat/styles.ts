import type { DeepChat } from "deep-chat-react"

type DeepChatProps = React.ComponentProps<typeof DeepChat>

const STYLE_PROPS: DeepChatProps = {
  style: {
    width: "100%",
    maxHeight: "60vh",
    height: "100%",
    display: "block",
    backgroundColor: "#F3F4F8",
  },
  inputAreaStyle: {
    padding: "12px 24px",
    backgroundColor: "#FFF",
  },
  textInput: {
    styles: {
      container: {
        margin: "0",
        alignItems: "center",
      },
    },
  },
  submitButtonStyles: {
    disabled: {
      container: {
        default: {
          backgroundColor: "#DDE1E6",
        },
      },
      svg: {
        styles: {
          default: {
            filter:
              "brightness(0) saturate(100%) invert(41%) sepia(0%) saturate(6404%) hue-rotate(22deg) brightness(100%) contrast(91%)",
          },
        },
      },
    },
    submit: {
      svg: {
        styles: {
          default: {
            filter:
              "brightness(0) saturate(100%) invert(100%) sepia(0%) saturate(7500%) hue-rotate(261deg) brightness(105%) contrast(110%)",
          },
        },
      },
      container: {
        default: {
          height: "48px",
          width: "48px",
          position: "static",
          margin: "0 12px",
          backgroundColor: "#A31F34",
          display: "flex",
          justifyContent: "center",
        },
        hover: {
          backgroundColor: "#750014",
        },
      },
    },
    loading: {
      text: {
        styles: {
          default: {
            left: "calc(-9990px - .325em)",
            bottom: "-0.125em",
          },
        },
      },
      container: {
        default: {
          height: "48px",
          width: "48px",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          position: "static",
        },
      },
    },
  },

  messageStyles: {
    default: {
      shared: {
        bubble: {
          color: "#212326",
          borderRadius: "100vh",
          border: "1px solid  #B8C2CC",
          background: "#FFF",
        },
      },
      ai: {
        bubble: {
          borderRadius: "0px 12px 12px 12px",
        },
      },
      user: {
        bubble: {
          borderRadius: "12px 0px 12px 12px",
        },
      },
    },
    html: {
      shared: {
        bubble: {
          border: "none",
          backgroundColor: "unset",
          padding: "0px",
        },
      },
    },
  },
  htmlClassUtilities: {
    "tim-suggestions": {
      styles: {
        default: {
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        },
      },
    },
    "tim-suggestion-button": {
      styles: {
        default: {
          borderRadius: "100vh",
        },
      },
    },
  },
  avatars: {
    user: {
      styles: {
        container: { display: "none" },
      },
    },
    ai: {
      src: "/images/mit_mascot_tim.png",
      styles: {
        avatar: { height: "40px", width: "40px" },
      },
    },
  },
}

export { STYLE_PROPS }
