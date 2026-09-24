export function VirtualRow({
  size,
  start,
  children,
}: {
  size: number;
  start: number;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: size,
        transform: `translateY(${start}px)`,
      }}
    >
      {children}
    </div>
  );
}
