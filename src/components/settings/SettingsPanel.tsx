'use client';
import { type ChangeEvent } from 'react';
import {
  DEFAULT_SETTINGS, FONT_FAMILIES, FLOWS, SPREAD_MODES, THEMES,
  resetSection, resetSettings, updateSetting,
  type FontFamily, type Flow, type Settings, type SettingsSection, type SpreadMode, type Theme,
} from '@/src/lib/settings';

type Props = { settings: Settings; onChange: (settings: Settings) => void; onFocusMode: () => void; canFocus: boolean };
const fontNames: Record<FontFamily, string> = { os: 'OS default', serif: 'Serif', sans: 'Sans', opendyslexic: 'Open Dyslexic', atkinson: 'Atkinson Hyperlegible', roboto: 'Roboto', robotomono: 'Roboto Mono' };

export default function SettingsPanel({ settings, onChange, onFocusMode, canFocus }: Props) {
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => onChange(updateSetting(settings, key, value));
  const range = (key: 'fontSize' | 'lineHeight' | 'contentWidth' | 'pageMargins' | 'paragraphSpacing') =>
    (event: ChangeEvent<HTMLInputElement>) => set(key, Number(event.target.value));
  const reset = (section: SettingsSection) => onChange(resetSection(settings, section));
  return <div className="settings-panel">
    <section><SectionTitle title="Appearance" onReset={() => reset('appearance')} />
      <fieldset><legend>Theme</legend><div className="choice-row">{THEMES.map(theme => <label key={theme}><input type="radio" name="theme" checked={settings.theme === theme} onChange={() => set('theme', theme as Theme)} /> {theme[0].toUpperCase() + theme.slice(1)}</label>)}</div></fieldset>
      <label className="control-row"><span>Reduce motion <small>Use system</small></span><select value={settings.reducedMotion === null ? 'system' : String(settings.reducedMotion)} onChange={e => set('reducedMotion', e.target.value === 'system' ? null : e.target.value === 'true')}><option value="system">System</option><option value="true">On</option><option value="false">Off</option></select></label>
    </section>
    <section><SectionTitle title="Typography" onReset={() => reset('typography')} />
      <label className="control-row"><span>Font family</span><select value={settings.fontFamily} onChange={e => set('fontFamily', e.target.value as FontFamily)}>{FONT_FAMILIES.map(v => <option value={v} key={v}>{fontNames[v]}</option>)}</select></label>
      <Range label="Font size" value={settings.fontSize} min={75} max={200} step={5} display={`${settings.fontSize}%`} onChange={range('fontSize')} />
      <Range label="Line height" value={settings.lineHeight} min={1.1} max={2.4} step={0.1} display={settings.lineHeight.toFixed(1)} onChange={range('lineHeight')} />
      <Range label="Paragraph spacing" value={settings.paragraphSpacing} min={0} max={2.5} step={0.25} display={`${settings.paragraphSpacing}em`} onChange={range('paragraphSpacing')} />
      <fieldset><legend>Text alignment</legend><div className="choice-row"><label><input type="radio" name="alignment" checked={settings.textAlignment === 'start'} onChange={() => set('textAlignment', 'start')} /> Start</label><label><input type="radio" name="alignment" checked={settings.textAlignment === 'justify'} onChange={() => set('textAlignment', 'justify')} /> Justified</label></div></fieldset>
      <Switch label="Hyphenation" checked={settings.hyphenation} onChange={v => set('hyphenation', v)} />
    </section>
    <section><SectionTitle title="Layout" onReset={() => reset('layout')} />
      <Range label="Content width" value={settings.contentWidth} min={480} max={1200} step={20} display={`${settings.contentWidth}px`} onChange={range('contentWidth')} />
      <Range label="Page margins" value={settings.pageMargins} min={0} max={96} step={4} display={`${settings.pageMargins}px`} onChange={range('pageMargins')} />
    </section>
    <section><SectionTitle title="Navigation" onReset={() => reset('navigation')} />
      <fieldset><legend>Reading flow</legend><div className="choice-row">{FLOWS.map(v => <label key={v}><input type="radio" name="flow" checked={settings.flow === v} onChange={() => set('flow', v as Flow)} /> {v === 'paginated' ? 'Pages' : 'Scroll'}</label>)}</div></fieldset>
      <label className="control-row"><span>Spread mode</span><select value={settings.spread} onChange={e => set('spread', e.target.value as SpreadMode)}>{SPREAD_MODES.map(v => <option value={v} key={v}>{v[0].toUpperCase() + v.slice(1)}</option>)}</select></label>
      <button onClick={onFocusMode} disabled={!canFocus}>Enter focus mode</button>
    </section>
    <div className={`settings-preview preview-${settings.fontFamily}`} aria-label="Settings preview"><strong>Preview</strong><p>A comfortable page keeps the story in focus.</p></div>
    <footer><button className="danger-button" onClick={() => onChange({ ...resetSettings(), panelPinned: settings.panelPinned, lastPinnedPanel: settings.lastPinnedPanel })} disabled={JSON.stringify(settings) === JSON.stringify(DEFAULT_SETTINGS)}>Reset reading settings</button></footer>
  </div>;
}

function SectionTitle({ title, onReset }: { title: string; onReset: () => void }) { return <div className="section-title"><h3>{title}</h3><button onClick={onReset}>Reset section</button></div>; }
function Range({ label, display, ...props }: { label: string; display: string; value: number; min: number; max: number; step: number; onChange: (e: ChangeEvent<HTMLInputElement>) => void }) { const id = label.toLowerCase().replaceAll(' ', '-'); return <label className="range-control" htmlFor={id}><span>{label} <output>{display}</output></span><input id={id} type="range" {...props} /></label>; }
function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) { return <label className="control-row"><span>{label}</span><button type="button" role="switch" aria-checked={checked} className="switch" onClick={() => onChange(!checked)}><span /></button></label>; }
