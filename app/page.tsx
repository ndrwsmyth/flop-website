import { FloppingPlatypus } from "./platypus";

export default function Home() {
  return (
    <main className="stage" aria-label="Flop landing page">
      <section className="copy" aria-labelledby="title">
        <p className="eyebrow">Pocket screensaver, marsupial-adjacent energy</p>
        <h1 id="title">Flop</h1>
        <p className="dek">
          A one-page home for a pixel platypus with a soft cream world, teal fur,
          and absolutely no respect for straight lines.
        </p>
      </section>

      <div className="screen-note" aria-hidden="true">
        Drag the platypus
      </div>

      <FloppingPlatypus />
    </main>
  );
}
