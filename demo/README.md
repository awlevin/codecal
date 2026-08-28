# codecal demo

The [Remotion](https://www.remotion.dev/) project behind `assets/codecal-demo.mp4` and `assets/hero.png`.

```bash
npm install
npx remotion studio                       # edit live
npx remotion render Demo out/demo.mp4     # the 19.5s video
npx remotion still Poster out/hero.png    # the README hero
```

Every session in the video is synthetic (`src/data.ts`), so no real transcript titles appear in it.
