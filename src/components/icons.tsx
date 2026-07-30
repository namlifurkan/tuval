type Props = { size?: number; strokeWidth?: number }

function Ico({ size = 20, strokeWidth = 1.4, d }: Props & { d: string[] }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="butt"
      strokeLinejoin="miter"
      aria-hidden
    >
      {d.map((p) => <path key={p} d={p} />)}
    </svg>
  )
}

export const Select = (p: Props) => <Ico {...p} d={['M5 3 L5 18 L9 14 L11.5 20 L14 19 L11.5 13.5 L17.5 13.5 Z']} />

export const Sticky = (p: Props) => (
  <Ico {...p} d={['M4 4 H20 V14.5 L14.5 20 H4 Z', 'M20 14.5 H14.5 V20']} />
)

export const TextTool = (p: Props) => (
  <Ico {...p} d={['M5 5 H19', 'M12 5 V19', 'M8.5 19 H15.5']} />
)

export const ShapeTool = (p: Props) => (
  <Ico {...p} d={['M3.5 3.5 H14 V14 H3.5 Z', 'M15 20.5 A5.5 5.5 0 1 1 15 9.5 A5.5 5.5 0 1 1 15 20.5 Z']} />
)

export const Connector = (p: Props) => (
  <Ico {...p} d={['M3 3 H8 V8 H3 Z', 'M16 16 H21 V21 H16 Z', 'M8 5.5 H13.5 V18.5 H16']} />
)

export const Nib = (p: Props) => (
  <Ico {...p} d={['M8.5 2.5 H15.5 V9 L12 21 L8.5 9 Z', 'M12 13.5 V21', 'M10.5 10.5 A1.5 1.5 0 1 1 13.5 10.5 A1.5 1.5 0 1 1 10.5 10.5 Z']} />
)

export const TableTool = (p: Props) => (
  <Ico {...p} d={['M3 4 H21 V20 H3 Z', 'M3 8.5 H21', 'M3 10 H21', 'M3 15 H21', 'M9 10 V20', 'M15 10 V20']} />
)

export const Mindmap = (p: Props) => (
  <Ico {...p} d={['M2.5 9.5 H7.5 V14.5 H2.5 Z', 'M7.5 12 H11', 'M11 6 V18', 'M11 6 H14', 'M11 18 H14', 'M14 3.5 H21.5 V8.5 H14 Z', 'M14 15.5 H21.5 V20.5 H14 Z']} />
)

export const FrameTool = (p: Props) => (
  <Ico {...p} d={['M3 9 V3 H9', 'M15 3 H21 V9', 'M21 15 V21 H15', 'M9 21 H3 V15']} />
)

export const Comment = (p: Props) => (
  <Ico {...p} d={['M3 4 H21 V15.5 H11 L6 20.5 V15.5 H3 Z']} />
)

export const Templates = (p: Props) => (
  <Ico {...p} d={['M3 3 H21 V21 H3 Z', 'M3 9 H21', 'M11 9 V21']} />
)

export const ImageTool = (p: Props) => (
  <Ico {...p} d={['M3 4.5 H21 V19.5 H3 Z', 'M3 16.5 L9 10.5 L13.5 15 L16.5 12.5 L21 16', 'M9.5 9 A1.9 1.9 0 1 1 9.5 5.2 A1.9 1.9 0 1 1 9.5 9 Z']} />
)

export const Minimap = (p: Props) => (
  <Ico {...p} d={['M3 5 H21 V19 H3 Z', 'M7 8.5 H14.5 V15.5 H7 Z']} />
)

export const Fit = (p: Props) => (
  <Ico {...p} d={['M3.5 9 V3.5 H9', 'M3.5 3.5 L9.5 9.5', 'M20.5 15 V20.5 H15', 'M20.5 20.5 L14.5 14.5', 'M15 3.5 H20.5 V9', 'M20.5 3.5 L14.5 9.5', 'M9 20.5 H3.5 V15', 'M3.5 20.5 L9.5 14.5']} />
)

export const EraserTool = (p: Props) => (
  <Ico {...p} d={['M3.5 16.5 L11 4.5 H20.5 L13 16.5 Z', 'M7.5 16.5 H20.5']} />
)

export const Highlight = (p: Props) => (
  <Ico {...p} d={['M8 3 H16 V9.5 L13 13 H11 L8 9.5 Z', 'M11 13 V18 H13 V13', 'M6.5 21 H17.5']} />
)

export const More = (p: Props) => (
  <Ico {...p} d={['M3.5 10.5 H6.5 V13.5 H3.5 Z', 'M10.5 10.5 H13.5 V13.5 H10.5 Z', 'M17.5 10.5 H20.5 V13.5 H17.5 Z']} />
)
