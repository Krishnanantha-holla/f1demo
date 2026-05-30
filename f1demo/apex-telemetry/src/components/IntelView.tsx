import { useState } from 'react';
import type { Driver } from '../types';
import type {
  NewsArticle,
  OpenF1RaceControlMessage,
  OpenF1TeamRadioRow,
  OpenF1PitStopRow,
} from '../services/f1Api';
import {
  Newspaper,
  ShieldAlert,
  Radio,
  Wrench,
  ExternalLink,
  Flag,
  RefreshCcw,
} from 'lucide-react';
import { ArticleModal } from './ArticleModal';

interface IntelViewProps {
  drivers: Driver[];
  news: NewsArticle[];
  raceControl: OpenF1RaceControlMessage[];
  teamRadio: OpenF1TeamRadioRow[];
  pitStops: OpenF1PitStopRow[];
  onRefresh?: () => void;
}

type Tab = 'news' | 'rc' | 'radio' | 'pits';

function fmtClock(iso?: string | null): string {
  if (!iso) return '--:--';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--:--';
  return d.toLocaleString([], {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: 'short',
  });
}

function flagColor(flag?: string | null, category?: string): string {
  const f = (flag || '').toLowerCase();
  const c = (category || '').toLowerCase();
  if (f.includes('red')) return 'border-red-500/40 bg-red-950/30 text-red-300';
  if (f.includes('yellow') || c === 'flag') return 'border-amber-400/40 bg-amber-950/20 text-amber-200';
  if (c === 'safetycar') return 'border-orange-400/40 bg-orange-950/20 text-orange-200';
  if (c === 'speedtrap') return 'border-sky-400/40 bg-sky-950/20 text-sky-200';
  if (c === 'sessionstatus') return 'border-purple-400/40 bg-purple-950/20 text-purple-200';
  return 'border-emerald-400/30 bg-emerald-950/15 text-emerald-200';
}

export default function IntelView({
  drivers,
  news,
  raceControl,
  teamRadio,
  pitStops,
  onRefresh,
}: IntelViewProps) {
  const [tab, setTab] = useState<Tab>('news');
  const [openArticle, setOpenArticle] = useState<NewsArticle | null>(null);

  const driverByNumber = new Map<number, Driver>();
  drivers.forEach(d => driverByNumber.set(d.number, d));

  const tabs: Array<{ id: Tab; label: string; icon: typeof Newspaper; count: number }> = [
    { id: 'news', label: 'NEWS FEED', icon: Newspaper, count: news.length },
    { id: 'rc', label: 'RACE CONTROL', icon: ShieldAlert, count: raceControl.length },
    { id: 'radio', label: 'TEAM RADIO', icon: Radio, count: teamRadio.length },
    { id: 'pits', label: 'PIT STOPS', icon: Wrench, count: pitStops.length },
  ];

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center bg-surface-container p-4 rounded-lg border border-white/5">
        <div className="flex items-center gap-2 flex-wrap">
          <Flag size={16} className="text-f1-red" />
          <span className="font-sans font-extrabold text-sm text-on-surface">
            ENGINEER INTEL & NEWSROOM
          </span>
          <span className="font-mono text-[10px] uppercase text-on-surface-variant">
            Sources: OpenF1 · Autosport · Motorsport · BBC · RaceFans · PlanetF1
          </span>
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="flex items-center gap-1 bg-f1-red/10 hover:bg-f1-red/20 border border-f1-red/30 text-f1-red px-3 py-1.5 rounded font-mono text-[10px] uppercase font-bold"
          >
            <RefreshCcw size={11} /> Refresh
          </button>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-wider rounded transition-colors border ${
              tab === t.id
                ? 'bg-f1-red text-white border-f1-red'
                : 'bg-white/5 hover:bg-white/10 text-on-surface-variant border-white/10'
            }`}
          >
            <t.icon size={11} />
            {t.label}
            <span className="font-mono text-[9px] opacity-70">({t.count})</span>
          </button>
        ))}
      </div>

      {tab === 'news' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {news.length === 0 ? (
            <div className="carbon-card rounded-lg p-8 text-center text-xs font-mono text-on-surface-variant col-span-full">
              No news yet. The RSS proxy is warming up. Try Refresh in a moment.
            </div>
          ) : (
            news.slice(0, 30).map((article, i) => (
              <button
                key={`${article.link}-${i}`}
                onClick={() => setOpenArticle(article)}
                className="carbon-card rounded-lg overflow-hidden flex flex-col group text-left"
              >
                {article.image ? (
                  <div
                    className="h-32 bg-cover bg-center opacity-80 group-hover:opacity-100 transition-opacity"
                    style={{ backgroundImage: `url('${article.image}')` }}
                  />
                ) : (
                  <div className="h-32 bg-surface-high flex items-center justify-center">
                    <Newspaper size={28} className="text-on-surface-variant/40" />
                  </div>
                )}
                <div className="p-4 flex-1 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-[10px] font-mono text-on-surface-variant uppercase tracking-wider">
                    <span className="text-f1-red font-bold">{article.source}</span>
                    <span>{fmtClock(article.published)}</span>
                  </div>
                  <h3 className="font-sans font-bold text-sm text-on-surface line-clamp-3 group-hover:text-f1-red transition-colors">
                    {article.title}
                  </h3>
                  {article.summary && (
                    <p className="font-sans text-[11px] text-on-surface-variant line-clamp-3 leading-snug">
                      {article.summary}
                    </p>
                  )}
                  <span className="mt-auto font-mono text-[10px] text-f1-red flex items-center gap-1">
                    READ STORY <ExternalLink size={10} />
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      )}

      <ArticleModal
        url={openArticle?.link ?? null}
        title={openArticle?.title}
        onClose={() => setOpenArticle(null)}
      />

      {tab === 'rc' && (
        <div className="carbon-card rounded-lg overflow-hidden">
          {raceControl.length === 0 ? (
            <div className="p-8 text-center text-xs font-mono text-on-surface-variant">
              No race control messages on the latest session.
            </div>
          ) : (
            <ul className="divide-y divide-white/5">
              {raceControl.slice(0, 80).map((rc, i) => (
                <li
                  key={`${rc.date}-${i}`}
                  className={`flex flex-col sm:flex-row gap-3 sm:items-center px-4 py-3 border-l-4 ${flagColor(
                    rc.flag,
                    rc.category,
                  )}`}
                >
                  <span className="font-mono text-[10px] uppercase font-bold w-32 shrink-0">
                    {fmtClock(rc.date)}
                  </span>
                  <span className="font-mono text-[10px] uppercase font-bold w-32 shrink-0">
                    {rc.category || 'RC'}
                    {rc.lap_number ? ` · L${rc.lap_number}` : ''}
                  </span>
                  <span className="font-sans text-sm text-on-surface flex-1">{rc.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'radio' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {teamRadio.length === 0 ? (
            <div className="carbon-card rounded-lg p-8 text-center text-xs font-mono text-on-surface-variant col-span-full">
              No team radio recordings on this session yet.
            </div>
          ) : (
            teamRadio.slice(0, 30).map((tr, i) => {
              const drv = driverByNumber.get(tr.driver_number);
              return (
                <div
                  key={`${tr.date}-${i}`}
                  className="carbon-card rounded-lg p-4 flex flex-col gap-3 border-l-4"
                  style={{ borderLeftColor: drv?.teamColor ?? '#888' }}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: drv?.teamColor ?? '#888' }}
                      />
                      <span className="font-sans font-extrabold text-sm">
                        {drv?.code ?? `#${tr.driver_number}`}
                      </span>
                      <span className="font-mono text-[10px] text-on-surface-variant uppercase">
                        {drv?.team ?? '—'}
                      </span>
                    </div>
                    <span className="font-mono text-[10px] text-on-surface-variant">
                      {fmtClock(tr.date)}
                    </span>
                  </div>
                  <audio controls preload="none" className="w-full" src={tr.recording_url}>
                    Your browser does not support audio playback.
                  </audio>
                </div>
              );
            })
          )}
        </div>
      )}

      {tab === 'pits' && (
        <div className="carbon-card rounded-lg overflow-x-auto">
          <table className="w-full text-left font-mono border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-surface-container text-[10px] font-black tracking-wider text-on-surface-variant uppercase border-b border-white/10">
                <th className="py-3 px-4">Lap</th>
                <th className="py-3 px-3">Driver</th>
                <th className="py-3 px-3">Team</th>
                <th className="py-3 px-3 text-right">Stationary</th>
                <th className="py-3 px-3">Time</th>
              </tr>
            </thead>
            <tbody>
              {pitStops.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-xs text-on-surface-variant">
                    No pit data for the current session.
                  </td>
                </tr>
              ) : (
                pitStops
                  .slice()
                  .sort((a, b) => a.pit_duration - b.pit_duration)
                  .slice(0, 50)
                  .map((p, i) => {
                    const drv = driverByNumber.get(p.driver_number);
                    return (
                      <tr key={`${p.date}-${i}`} className="border-b border-white/5 text-xs hover:bg-white/5">
                        <td className="py-3 px-4 font-bold">{p.lap_number}</td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-1 h-4 rounded"
                              style={{ backgroundColor: drv?.teamColor ?? '#888' }}
                            />
                            <span className="font-bold">{drv?.code ?? `#${p.driver_number}`}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-on-surface-variant uppercase text-[10px]">
                          {drv?.team ?? '—'}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-emerald-400">
                          {p.pit_duration.toFixed(2)}s
                        </td>
                        <td className="py-3 px-3 text-on-surface-variant">{fmtClock(p.date)}</td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
