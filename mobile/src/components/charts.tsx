import { useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import Svg, { Circle, G, Line, Path } from 'react-native-svg'
import { font } from '@/lib/theme'
import { Txt } from './ui'

/**
 * Small, dependency-free charts for the analytics screen, built to the data-viz
 * spec: thin columns (≤ 24 px, 4 px rounded data-end, square at the baseline,
 * 2 px gaps), 2 px lines with a 10 % area wash and a ringed end-dot, hairline
 * gridlines one step off the surface, text in text colours (never series
 * colours), and a tap/hover tooltip on every mark.
 */
const INK = { text: '#1E293B', muted: '#64748B', faint: '#94A3B8', grid: '#EEF2F6', surface: '#FFFFFF' }

/** Rounds an axis maximum up to 1 / 2 / 4 / 5 × 10ⁿ — values whose half is still a round number. */
export function niceMax(v: number): number {
  if (v <= 0) return 1
  const exp = 10 ** Math.floor(Math.log10(v))
  const f = v / exp
  const step = f <= 1 ? 1 : f <= 2 ? 2 : f <= 4 ? 4 : f <= 5 ? 5 : 10
  return step * exp
}

/** Every nth x label plus the last — dropping any that would sit within a label's width of the last. */
const LABEL_W = 44
function showLabel(i: number, n: number, every: number, spacing: number) {
  if (i === n - 1) return true
  return i % every === 0 && (n - 1 - i) * spacing >= LABEL_W + 4
}

function useWidth(): [number, (e: LayoutChangeEvent) => void] {
  const [w, setW] = useState(0)
  return [w, (e) => setW(Math.round(e.nativeEvent.layout.width))]
}

function Tooltip({ x, width, title, value }: { x: number; width: number; title: string; value: string }) {
  const W = 120
  const left = Math.min(Math.max(x - W / 2, 0), Math.max(0, width - W))
  return (
    <View pointerEvents="none" style={[styles.tip, { left, width: W }]}>
      <Txt style={styles.tipValue}>{value}</Txt>
      <Txt style={styles.tipTitle} numberOfLines={1}>{title}</Txt>
    </View>
  )
}

type Point = { label: string; title: string; value: number | null }

/** Column (vertical bar) chart — one series. */
export function ColumnChart({ data, height = 150, color, format = String, labelEvery, minMax = 4, empty = 'No activity yet' }: {
  data: Point[]; height?: number; color: string; format?: (v: number) => string; labelEvery?: number
  /** Smallest axis maximum — keeps count axes on whole numbers (0 · 2 · 4). */
  minMax?: number
  empty?: string
}) {
  const [width, onLayout] = useWidth()
  const [active, setActive] = useState<number | null>(null)
  const axisW = 30
  const plotW = Math.max(0, width - axisW)
  const top = 34
  const plotH = height - top - 18
  const max = niceMax(Math.max(minMax, ...data.map(d => d.value ?? 0)))
  const isEmpty = data.every(d => !d.value)
  const band = data.length ? plotW / data.length : 0
  const bar = Math.max(2, Math.min(24, band - 2))
  const every = labelEvery ?? Math.max(1, Math.ceil(data.length / 6))
  const yOf = (v: number) => top + plotH - (v / max) * plotH
  const ticks = [...new Set([0, Math.round(max / 2), max])]

  return (
    <View onLayout={onLayout} style={{ height }}>
      {width > 0 && (
        <>
          <Svg width={width} height={height}>
            {ticks.map(v => (
              <G key={v}>
                <Line x1={axisW} x2={width} y1={yOf(v)} y2={yOf(v)} stroke={INK.grid} strokeWidth={1} />
              </G>
            ))}
            {data.map((d, i) => {
              const v = d.value ?? 0
              if (v <= 0) return null
              const h = Math.max(2, (v / max) * plotH)
              const x = axisW + i * band + (band - bar) / 2
              const y = top + plotH - h
              const r = Math.min(4, bar / 2, h)
              // Rounded data-end, square baseline.
              const path = `M${x},${top + plotH} V${y + r} Q${x},${y} ${x + r},${y} H${x + bar - r} Q${x + bar},${y} ${x + bar},${y + r} V${top + plotH} Z`
              return <Path key={i} d={path} fill={color} opacity={active === null || active === i ? 1 : 0.45} />
            })}
          </Svg>
          {/* Axis labels (text tokens, not series colour) */}
          {ticks.map(v => (
            <Txt key={v} style={[styles.yLabel, { top: yOf(v) - 7 }]}>{format(v)}</Txt>
          ))}
          {data.map((d, i) => showLabel(i, data.length, every, band) && (
            <Txt key={i} style={[styles.xLabel, { left: Math.min(width - LABEL_W, Math.max(0, axisW + i * band + band / 2 - LABEL_W / 2)), width: LABEL_W, top: height - 14 }]} numberOfLines={1}>{d.label}</Txt>
          ))}
          {isEmpty && <Txt style={[styles.empty, { top: top + plotH / 2 - 8, left: axisW }]}>{empty}</Txt>}
          {/* Hit targets: the whole band, bigger than the mark */}
          <View style={[StyleSheet.absoluteFill, { left: axisW, flexDirection: 'row', top }]}>
            {data.map((d, i) => (
              <Pressable key={i} style={{ width: band, height: plotH }} onPressIn={() => setActive(i)} onPressOut={() => setActive(null)}
                onHoverIn={() => setActive(i)} onHoverOut={() => setActive(null)} accessibilityLabel={`${d.title}: ${d.value === null ? 'no data' : format(d.value)}`} />
            ))}
          </View>
          {active !== null && data[active] && (
            <Tooltip x={axisW + active * band + band / 2} width={width} title={data[active]!.title}
              value={data[active]!.value === null ? '—' : format(data[active]!.value!)} />
          )}
        </>
      )}
    </View>
  )
}

/** Line chart with an area wash — one series; gaps where there's no data. */
export function LineChart({ data, height = 150, color, format = String }: {
  data: Point[]; height?: number; color: string; format?: (v: number) => string
}) {
  const [width, onLayout] = useWidth()
  const [active, setActive] = useState<number | null>(null)
  const axisW = 36
  const plotW = Math.max(0, width - axisW - 8)
  const top = 34
  const plotH = height - top - 18
  const max = niceMax(Math.max(0, ...data.map(d => d.value ?? 0)))
  const isEmpty = data.every(d => d.value === null)
  const step = data.length > 1 ? plotW / (data.length - 1) : plotW
  const xOf = (i: number) => axisW + 4 + i * step
  const yOf = (v: number) => top + plotH - (v / max) * plotH

  // Split into runs of consecutive points with data.
  const runs: { i: number; v: number }[][] = []
  data.forEach((d, i) => {
    if (d.value === null) return
    const last = runs[runs.length - 1]
    if (last && last[last.length - 1]!.i === i - 1) last.push({ i, v: d.value })
    else runs.push([{ i, v: d.value }])
  })
  const lastPoint = runs.length ? runs[runs.length - 1]![runs[runs.length - 1]!.length - 1]! : null
  const every = Math.max(1, Math.ceil(data.length / 6))

  return (
    <View onLayout={onLayout} style={{ height }}>
      {width > 0 && (
        <>
          <Svg width={width} height={height}>
            {[0, 0.5, 1].map(f => <Line key={f} x1={axisW} x2={width} y1={yOf(max * f)} y2={yOf(max * f)} stroke={INK.grid} strokeWidth={1} />)}
            {runs.map((run, k) => {
              const line = run.map((p, j) => `${j ? 'L' : 'M'}${xOf(p.i)},${yOf(p.v)}`).join(' ')
              const area = `${line} L${xOf(run[run.length - 1]!.i)},${top + plotH} L${xOf(run[0]!.i)},${top + plotH} Z`
              return (
                <G key={k}>
                  {run.length > 1 && <Path d={area} fill={color} opacity={0.1} />}
                  {run.length > 1 && <Path d={line} stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />}
                  {run.length === 1 && <Circle cx={xOf(run[0]!.i)} cy={yOf(run[0]!.v)} r={3} fill={color} />}
                </G>
              )
            })}
            {active !== null && <Line x1={xOf(active)} x2={xOf(active)} y1={top} y2={top + plotH} stroke="#CBD5E1" strokeWidth={1} />}
            {(active !== null && data[active]?.value != null ? [{ i: active, v: data[active]!.value! }] : lastPoint ? [lastPoint] : []).map(p => (
              <Circle key="dot" cx={xOf(p.i)} cy={yOf(p.v)} r={4.5} fill={color} stroke={INK.surface} strokeWidth={2} />
            ))}
          </Svg>
          {[0, 0.5, 1].map(f => <Txt key={f} style={[styles.yLabel, { top: yOf(max * f) - 7, width: axisW - 6 }]}>{format(max * f)}</Txt>)}
          {data.map((d, i) => showLabel(i, data.length, every, step) && (
            <Txt key={i} style={[styles.xLabel, { left: Math.min(width - LABEL_W, Math.max(0, xOf(i) - LABEL_W / 2)), width: LABEL_W, top: height - 14 }]} numberOfLines={1}>{d.label}</Txt>
          ))}
          {isEmpty && <Txt style={[styles.empty, { top: top + plotH / 2 - 8, left: axisW }]}>No replies in this period</Txt>}
          <View style={[StyleSheet.absoluteFill, { left: axisW, flexDirection: 'row', top }]}>
            {data.map((d, i) => (
              <Pressable key={i} style={{ width: data.length > 1 ? (i === 0 || i === data.length - 1 ? step / 2 + 4 : step) : plotW, height: plotH }}
                onPressIn={() => setActive(i)} onPressOut={() => setActive(null)} onHoverIn={() => setActive(i)} onHoverOut={() => setActive(null)}
                accessibilityLabel={`${d.title}: ${d.value === null ? 'no data' : format(d.value)}`} />
            ))}
          </View>
          {active !== null && data[active] && (
            <Tooltip x={xOf(active)} width={width} title={data[active]!.title} value={data[active]!.value === null ? 'No replies' : format(data[active]!.value!)} />
          )}
        </>
      )}
    </View>
  )
}

/** Tiny trend line for a stat tile: de-emphasised line, current point in the accent. */
export function Sparkline({ values, color, width = 64, height = 22 }: { values: (number | null)[]; color: string; width?: number; height?: number }) {
  const nums = values.map(v => v ?? 0)
  if (nums.length < 2) return null
  const max = Math.max(1, ...nums)
  const step = (width - 4) / (nums.length - 1)
  const y = (v: number) => 2 + (height - 4) - (v / max) * (height - 4)
  const d = nums.map((v, i) => `${i ? 'L' : 'M'}${2 + i * step},${y(v)}`).join(' ')
  return (
    <Svg width={width} height={height}>
      <Path d={d} stroke="#CBD5E1" strokeWidth={1.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      <Circle cx={2 + (nums.length - 1) * step} cy={y(nums[nums.length - 1]!)} r={2.5} fill={color} />
    </Svg>
  )
}

/** Donut with a 2 px surface gap between segments and the total in the middle. */
export function Donut({ segments, size = 128, thickness = 16, center }: {
  segments: { key: string; value: number; color: string }[]; size?: number; thickness?: number; center?: ReactNode
}) {
  const total = segments.reduce((n, s) => n + s.value, 0)
  const r = (size - thickness) / 2
  const c = size / 2
  const circ = 2 * Math.PI * r
  const gap = segments.filter(s => s.value > 0).length > 1 ? 2 : 0
  let offset = 0
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={c} cy={c} r={r} stroke="#F1F5F9" strokeWidth={thickness} fill="none" />
        {total > 0 && segments.map(s => {
          if (s.value <= 0) return null
          const len = (s.value / total) * circ
          const el = (
            <Circle key={s.key} cx={c} cy={c} r={r} stroke={s.color} strokeWidth={thickness} fill="none"
              strokeDasharray={`${Math.max(0, len - gap)} ${circ}`} strokeDashoffset={-offset} transform={`rotate(-90 ${c} ${c})`} />
          )
          offset += len
          return el
        })}
      </Svg>
      {center}
    </View>
  )
}

/** A thin horizontal meter (leaderboard): value ÷ max, lighter track of the same hue. */
export function Meter({ value, max, color, track }: { value: number; max: number; color: string; track: string }) {
  return (
    <View style={[styles.meter, { backgroundColor: track }]}>
      <View style={{ width: `${max > 0 ? Math.max(value > 0 ? 3 : 0, (value / max) * 100) : 0}%`, backgroundColor: color, borderRadius: 3 }} />
    </View>
  )
}

const styles = StyleSheet.create({
  yLabel: { position: 'absolute', left: 0, width: 26, textAlign: 'right', fontFamily: font.medium, fontSize: 9.5, lineHeight: 12, color: INK.faint },
  xLabel: { position: 'absolute', textAlign: 'center', fontFamily: font.medium, fontSize: 9.5, lineHeight: 12, color: INK.faint },
  tip: {
    position: 'absolute', top: 0, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: '#0F172A',
    alignItems: 'center',
  },
  tipValue: { fontFamily: font.bold, fontSize: 12, lineHeight: 15, color: '#FFFFFF' },
  tipTitle: { fontFamily: font.medium, fontSize: 9.5, lineHeight: 12, color: '#CBD5E1' },
  meter: { height: 6, borderRadius: 3, overflow: 'hidden', flexDirection: 'row' },
  empty: { position: 'absolute', right: 0, textAlign: 'center', fontFamily: font.medium, fontSize: 11.5, color: INK.faint },
})
