interface ColumnResizerProps {
  onResize: (deltaX: number) => void;
  onResizeEnd: () => void;
}

export function ColumnResizer({ onResize, onResizeEnd }: ColumnResizerProps) {
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    let lastX = e.clientX;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - lastX;
      lastX = moveEvent.clientX;
      onResize(deltaX);
    };
    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      document.body.classList.remove("resizing-columns");
      onResizeEnd();
    };

    document.body.classList.add("resizing-columns");
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  return <div className="col-resizer" onMouseDown={handleMouseDown} />;
}
