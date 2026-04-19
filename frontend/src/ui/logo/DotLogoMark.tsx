import { DotLogoConstruction } from './DotLogoConstruction'

type Props = {
  width?: number
  height?: number
}

export function DotLogoMark({ width = 150, height = 34 }: Props) {
  return <DotLogoConstruction width={width} height={height} density="high" autoplay={false} />
}

