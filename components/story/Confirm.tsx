/** Text with its [CONFIRM …] markers set small and muted (shown until the copy is approved). */
export function Confirm({ text }: { text: string }) {
  const parts = text.split(/(\s*\[CONFIRM[^\]]*\])/);
  return (
    <>
      {parts.map((p, i) =>
        /\[CONFIRM/.test(p) ? (
          <span key={i} className="py-confirm">
            {p}
          </span>
        ) : (
          p
        ),
      )}
    </>
  );
}
