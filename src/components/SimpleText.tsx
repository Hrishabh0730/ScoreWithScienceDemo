/** Renders a tiny safe subset of Markdown: "## " headings, "- " bullets, paragraphs. No HTML. */
export function SimpleText({ text }: { text: string }) {
  const blocks = text.replace(/\r/g, "").split(/\n\s*\n/);
  return (
    <div className="prose-policy">
      {blocks.map((b, i) => {
        const lines = b.split("\n").filter((l) => l.trim());
        if (!lines.length) return null;
        const out: React.ReactNode[] = [];
        let bullets: string[] = [];
        const flush = () => {
          if (bullets.length) out.push(<ul key={`u${out.length}`}>{bullets.map((x, j) => <li key={j}>{x}</li>)}</ul>);
          bullets = [];
        };
        for (const l of lines) {
          if (l.startsWith("## ")) {
            flush();
            out.push(<h2 key={`h${out.length}`}>{l.slice(3)}</h2>);
          } else if (/^[-*] /.test(l)) bullets.push(l.slice(2));
          else {
            flush();
            out.push(<p key={`p${out.length}`}>{l}</p>);
          }
        }
        flush();
        return <div key={i}>{out}</div>;
      })}
    </div>
  );
}
