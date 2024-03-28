/* eslint-disable @typescript-eslint/no-var-requires */
const path = require("path")
const webpack = require("webpack")
const BundleTracker = require("webpack-bundle-tracker")
const MiniCssExtractPlugin = require("mini-css-extract-plugin")
const { BundleAnalyzerPlugin } = require("webpack-bundle-analyzer")
const { withCKEditor } = require("ol-ckeditor/webpack-utils")
const TsconfigPathsPlugin = require("tsconfig-paths-webpack-plugin")
const HtmlWebpackPlugin = require("html-webpack-plugin")
const CopyPlugin = require("copy-webpack-plugin")

const { NODE_ENV, PORT, API_BASE_URL, WEBPACK_ANALYZE } = process.env

const getPublicPath = (isProduction) => {
  if (isProduction) {
    return "/static/mit-open/"
  }
  return "auto"
}

module.exports = (env, argv) => {
  const mode = argv.mode || NODE_ENV || "production"

  console.info("Webpack build mode is:", mode)

  const isProduction = mode === "production"

  const publicPath = getPublicPath(isProduction)

  console.info("Public path is:", publicPath)

  const config = {
    mode,
    context: __dirname,
    devtool: "source-map",
    entry: {
      root: "./src/App",
    },
    output: {
      path: path.resolve(__dirname, "build"),
      ...(mode === "production"
        ? {
            filename: "[name]-[chunkhash].js",
            chunkFilename: "[id]-[chunkhash].js",
            crossOriginLoading: "anonymous",
            hashFunction: "xxhash64",
          }
        : {
            filename: "[name].js",
          }),
      publicPath,
      clean: true,
    },
    module: {
      rules: [
        {
          test: /\.(svg|ttf|woff|woff2|eot|gif|png)$/,
          exclude: /@ckeditor/,
          type: "asset/inline",
        },
        {
          test: /\.tsx?$/,
          use: "swc-loader",
          exclude: /node_modules/,
        },
        {
          test: /\.css$/i,
          exclude: /@ckeditor/,
          use: ["style-loader", "css-loader"],
        },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: "public/index.html",
      }),
      new CopyPlugin({
        patterns: [{ from: "public/images", to: "static/images" }],
      }),
      new BundleTracker({
        // path: path.join(__dirname, "assets"),
        filename: "webpack-stats.json",
      }),
      new webpack.DefinePlugin({
        "process.env": {
          env: { NODE_ENV: JSON.stringify(mode) },
        },
      }),
    ]
      .concat(
        isProduction
          ? [
              new webpack.LoaderOptionsPlugin({ minimize: true }),
              new webpack.optimize.AggressiveMergingPlugin(),
              new MiniCssExtractPlugin({
                filename: "[name]-[contenthash].css",
              }),
            ]
          : [],
      )
      .concat(
        WEBPACK_ANALYZE === "True"
          ? [
              new BundleAnalyzerPlugin({
                analyzerMode: "static",
              }),
            ]
          : [],
      ),
    resolve: {
      extensions: [".js", ".jsx", ".ts", ".tsx"],
      plugins: [new TsconfigPathsPlugin()],
    },
    performance: {
      hints: false,
    },
    optimization: {
      moduleIds: "named",
      splitChunks: {
        name: "common",
        minChunks: 2,
        ...(isProduction
          ? {
              cacheGroups: {
                common: {
                  test: /[\\/]node_modules[\\/]/,
                  name: "common",
                  chunks: "all",
                },
              },
            }
          : {}),
      },
      minimize: isProduction,
      emitOnErrors: false,
    },
    devServer: {
      port: PORT || 8080,
      allowedHosts: "all",
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      hot: true,
      host: "::",
      historyApiFallback: true,
      static: {
        directory: path.join(__dirname, "public"),
        publicPath: "/static",
      },
      proxy: [
        {
          context: ["/api", "/login", "/admin", "/static/admin"],
          target: API_BASE_URL,
          changeOrigin: true,
          secure: false,
          headers: {
            Origin: API_BASE_URL,
          },
        },
      ],
    },
  }
  return withCKEditor(config)
}
