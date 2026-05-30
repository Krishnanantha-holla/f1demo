import { useMemo, useState } from 'react';
import type { Driver } from '../types';
import type {
  ConstructorStandings,
  DriverStandings,
  SeasonAggregate,
} from '../services/f1Api';
import { Award, Landmark, Star, Trophy } from 'lucide-react';

interface StandingsViewProps {
  drivers: Driver[];
  driverStandings?: DriverStandings | null;
  constructorStandings?: ConstructorStandings | null;
  seasonAggregates?: SeasonAggregate | null;
}

const TEAM_PALETTE: Record<string, string> = {
  Mercedes: '#27F4D2',
  Ferrari: '#E10600',
  McLaren: '#FF8700',
  'Red Bull': '#3671C6',
  'Alpine F1 Team': '#FF87CD',
  'RB F1 Team': '#1260F0',
  'Haas F1 Team': '#B6BABD',
  Williams: '#37BEDD',
  Audi: '#52E252',
  'Cadillac F1 Team': '#888888',
  'Aston Martin': '#229971',
};

interface DriverRow {
  id: string;
  position: number;
  code: string;
  name: string;
  number: number;
  team: string;
  teamColor: string;
  points: number;
  wins: number;
  podiums: number;
}

interface ConstructorRow {
  position: number;
  name: string;
  points: number;
  wins: number;
  podiums: number;
  primaryColor: string;
}

export default function StandingsView({
  drivers,
  driverStandings,
  constructorStandings,
  seasonAggregates,
}: StandingsViewProps) {
  const [tab, setTab] = useState<'drivers' | 'constructors'>('drivers');

  const driverColorByCode = useMemo(() => {
    const map = new Map<string, string>();
    drivers.forEach(d => map.set(d.code.toUpperCase(), d.teamColor));
    return map;
  }, [drivers]);

  const driverRows: DriverRow[] = useMemo(() => {
    if (driverStandings?.rows.length) {
      return driverStandings.rows.map((row, i) => {
        const code = row.Driver.code || row.Driver.familyName.slice(0, 3).toUpperCase();
        return {
          id: row.Driver.code || row.Driver.driverId || `p${i}`,
          position: Number(row.position) || i + 1,
          code,
          name: `${row.Driver.givenName} ${row.Driver.familyName}`,
          number: row.Driver.permanentNumber ? Number(row.Driver.permanentNumber) : 0,
          team: row.Constructors[0]?.name ?? '—',
          teamColor: driverColorByCode.get(code.toUpperCase()) ?? '#888888',
          points: Number(row.points) || 0,
          wins: Number(row.wins) || 0,
          podiums: seasonAggregates?.podiumsByDriver?.[code] ?? 0,
        };
      });
    }
    return [...drivers]
      .sort((a, b) => b.points - a.points)
      .map((d, i) => ({
        id: d.id,
        position: i + 1,
        code: d.code,
        name: d.name,
        number: d.number,
        team: d.team,
        teamColor: d.teamColor,
        points: d.points,
        wins: 0,
        podiums: 0,
      }));
  }, [drivers, driverStandings, driverColorByCode, seasonAggregates]);

  const constructorRows: ConstructorRow[] = useMemo(() => {
    if (constructorStandings?.rows.length) {
      return constructorStandings.rows.map((row, i) => ({
        position: Number(row.position) || i + 1,
        name: row.Constructor.name,
        points: Number(row.points) || 0,
        wins: Number(row.wins) || 0,
        podiums: 0,
        primaryColor: TEAM_PALETTE[row.Constructor.name] ?? '#888888',
      }));
    }
    return [
      { position: 1, name: 'Red Bull Racing', points: 98, wins: 2, podiums: 3, primaryColor: '#3671C6' },
      { position: 2, name: 'Ferrari', points: 87, wins: 0, podiums: 3, primaryColor: '#E10600' },
      { position: 3, name: 'McLaren', points: 72, wins: 1, podiums: 2, primaryColor: '#FF8700' },
      { position: 4, name: 'Mercedes-AMG', points: 47, wins: 0, podiums: 1, primaryColor: '#27F4D2' },
    ];
  }, [constructorStandings]);

  const seasonLabel = driverStandings?.season ?? constructorStandings?.season ?? '—';
  const roundLabel = driverStandings?.round ?? constructorStandings?.round ?? '—';
  const maxDriverPoints = driverRows[0]?.points || 1;
  const maxConstructPoints = constructorRows[0]?.points || 1;

  // Aggregate fastest-lap totals for the right-hand insight card.
  const fastestLapRanking = useMemo(() => {
    if (!seasonAggregates) return [];
    return Object.entries(seasonAggregates.fastestLapsByDriver)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [seasonAggregates]);

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      <div className="flex justify-between items-center border-b border-white/5 pb-2">
        <div className="flex gap-2">
          <button
            onClick={() => setTab('drivers')}
            className={`flex items-center gap-1.5 px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider rounded transition-all ${
              tab === 'drivers'
                ? 'bg-f1-red text-white'
                : 'bg-white/5 hover:bg-white/10 text-on-surface-variant'
            }`}
          >
            <Trophy size={13} fill="currentColor" /> WORLD DRIVERS
          </button>
          <button
            onClick={() => setTab('constructors')}
            className={`flex items-center gap-1.5 px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider rounded transition-all ${
              tab === 'constructors'
                ? 'bg-f1-red text-white'
                : 'bg-white/5 hover:bg-white/10 text-on-surface-variant'
            }`}
          >
            <Landmark size={13} /> WORLD CONSTRUCTORS
          </button>
        </div>
        <span className="text-[10px] text-on-surface-variant font-mono uppercase bg-white/5 border border-white/5 px-2 py-1 rounded">
          {seasonLabel} · ROUND {roundLabel}
        </span>
      </div>

      {tab === 'drivers' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-8 carbon-card rounded-lg overflow-x-auto">
            <table className="w-full text-left font-mono border-collapse min-w-[500px]">
              <thead>
                <tr className="bg-surface-container text-[10px] font-black tracking-wider text-on-surface-variant border-b border-white/10 uppercase">
                  <th className="py-3 px-4 w-12 text-center">POS</th>
                  <th className="py-3 px-2 w-10">NO</th>
                  <th className="py-3 px-3">DRIVER / TEAM</th>
                  <th className="py-3 px-4 w-36">CHAMPIONSHIP BAR</th>
                  <th className="py-3 px-4 text-center">WINS</th>
                  <th className="py-3 px-4 text-center">PODIUMS</th>
                  <th className="py-3 px-4 text-right">POINTS</th>
                </tr>
              </thead>
              <tbody>
                {driverRows.map(row => (
                  <tr
                    key={row.id}
                    className="border-b border-white/5 text-xs text-on-surface/90 hover:bg-white/5 transition-all"
                  >
                    <td className="py-3 text-center font-bold font-sans italic text-f1-red text-sm">
                      {row.position}
                    </td>
                    <td className="py-3 px-2 font-bold text-[11px] text-white/40">
                      {row.number || '—'}
                    </td>
                    <td className="py-3 px-3 uppercase">
                      <div className="flex items-center gap-3.5">
                        <div className="w-1.5 h-4 rounded-sm" style={{ backgroundColor: row.teamColor }} />
                        <div className="flex flex-col">
                          <span className="font-sans font-black text-sm text-on-surface tracking-tight">
                            {row.code}
                            <span className="font-normal font-mono text-xs text-on-surface-variant tracking-wide lowercase italic ml-1.5 hidden md:inline">
                              {row.name}
                            </span>
                          </span>
                          <span className="text-[9px] text-on-surface-variant/70 font-mono tracking-wider">
                            {row.team}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="w-full bg-white/5 h-2 rounded mt-1 overflow-hidden">
                        <div
                          className="h-full rounded-sm transition-all duration-500"
                          style={{
                            width: `${(row.points / maxDriverPoints) * 100}%`,
                            backgroundColor: row.teamColor,
                          }}
                        />
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center text-sm font-semibold text-white/50">
                      {row.wins > 0 ? (
                        <span className="text-yellow-500 flex items-center justify-center gap-0.5 font-bold">
                          <Star size={11} fill="currentColor" /> {row.wins}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="py-3 px-4 text-center text-sm font-bold text-on-surface-variant">
                      {row.podiums || '-'}
                    </td>
                    <td className="py-3 px-4 text-right pr-6 font-black text-[13px] text-on-surface">
                      {row.points} PTS
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="lg:col-span-4 flex flex-col gap-4">
            <div className="carbon-card rounded-lg p-5">
              <h3 className="font-sans font-black text-sm text-on-surface border-b border-white/5 pb-2 uppercase tracking-wide">
                Championship insight
              </h3>
              <p className="font-sans text-xs text-on-surface-variant mt-3 leading-relaxed">
                {driverRows[0]
                  ? `${driverRows[0].name} leads the ${seasonLabel} season after round ${roundLabel} with ${driverRows[0].points} points and ${driverRows[0].wins} ${
                      driverRows[0].wins === 1 ? 'win' : 'wins'
                    }.`
                  : 'Standings will populate once Jolpica returns the latest round.'}
              </p>
              <div className="mt-4 flex flex-col gap-3 font-mono text-xs">
                <KV
                  label="Lead margin"
                  value={
                    driverRows[0] && driverRows[1]
                      ? `${driverRows[0].points - driverRows[1].points} PTS (${driverRows[0].code} OVER ${driverRows[1].code})`
                      : '—'
                  }
                  accent="text-f1-red"
                />
                <KV label="Drivers classified" value={String(driverRows.length)} />
                <KV
                  label="Source"
                  value={driverStandings ? 'JOLPICA / ERGAST' : 'CACHED SEED'}
                  accent="text-emerald-400"
                />
              </div>
            </div>

            <div className="carbon-card rounded-lg p-5 flex-1 flex flex-col justify-between">
              <div className="flex items-center gap-2">
                <Award size={15} className="text-yellow-500" />
                <span className="font-sans font-bold text-xs text-on-surface-variant uppercase">
                  Fastest-lap leaderboard
                </span>
              </div>
              {fastestLapRanking.length > 0 ? (
                <ul className="mt-4 flex flex-col gap-1.5 font-mono text-xs">
                  {fastestLapRanking.map(([code, count], i) => (
                    <li
                      key={code}
                      className="flex justify-between bg-black/30 border border-white/5 px-3 py-1.5 rounded"
                    >
                      <span>
                        <span className="text-on-surface-variant mr-2">{i + 1}</span>
                        <span className="font-bold text-on-surface">{code}</span>
                      </span>
                      <span className="text-emerald-400 font-bold">{count} FL</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-xs font-mono text-on-surface-variant italic">
                  No fastest-lap awards recorded yet this season.
                </p>
              )}
              <div className="text-[9px] text-white/30 font-mono mt-3 uppercase italic">
                Aggregated from Jolpica race results across the entire season.
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-8 carbon-card rounded-lg overflow-x-auto">
            <table className="w-full text-left font-mono border-collapse min-w-[500px]">
              <thead>
                <tr className="bg-surface-container text-[10px] font-black text-on-surface-variant border-b border-white/10 uppercase tracking-wider">
                  <th className="py-3 px-4 w-12 text-center">POS</th>
                  <th className="py-3 px-3">TEAM CONSTRUCTOR</th>
                  <th className="py-3 px-4 w-36">CHAMPIONSHIP BAR</th>
                  <th className="py-3 px-4 text-center">WINS</th>
                  <th className="py-3 px-4 text-right">POINTS</th>
                </tr>
              </thead>
              <tbody>
                {constructorRows.map(team => (
                  <tr
                    key={team.name}
                    className="border-b border-white/5 text-xs text-on-surface/90 hover:bg-white/5 transition-all"
                  >
                    <td className="py-3 text-center font-bold font-sans italic text-f1-red text-sm">
                      {team.position}
                    </td>
                    <td className="py-3 px-3 uppercase">
                      <div className="flex items-center gap-3.5">
                        <div className="w-1.5 h-4 rounded-sm" style={{ backgroundColor: team.primaryColor }} />
                        <span className="font-sans font-extrabold text-sm text-on-surface tracking-tight">
                          {team.name}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="w-full bg-white/5 h-2 rounded mt-1 overflow-hidden">
                        <div
                          className="h-full rounded-sm transition-all duration-500"
                          style={{
                            width: `${(team.points / maxConstructPoints) * 100}%`,
                            backgroundColor: team.primaryColor,
                          }}
                        />
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center text-sm font-semibold">
                      {team.wins > 0 ? (
                        <span className="text-yellow-500 flex items-center justify-center gap-0.5 font-bold">
                          <Star size={11} fill="currentColor" /> {team.wins}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="py-3 px-4 text-right pr-6 font-black text-[13px] text-on-surface">
                      {team.points} PTS
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="lg:col-span-4 flex flex-col gap-4">
            <div className="carbon-card rounded-lg p-5">
              <h3 className="font-sans font-black text-sm text-on-surface border-b border-white/5 pb-2 uppercase tracking-wide">
                Constructor margin
              </h3>
              <p className="font-sans text-xs text-on-surface-variant mt-3 leading-relaxed">
                {constructorRows[0] && constructorRows[1]
                  ? `${constructorRows[0].name} leads ${constructorRows[1].name} by ${
                      constructorRows[0].points - constructorRows[1].points
                    } pts after ${roundLabel} rounds.`
                  : 'Constructor data will populate once Jolpica responds.'}
              </p>
              <div className="mt-4 flex flex-col gap-3 font-mono text-xs">
                <KV label="Total wins" value={String(constructorRows.reduce((a, t) => a + t.wins, 0))} />
                <KV label="Constructors" value={String(constructorRows.length)} />
                <KV
                  label="Source"
                  value={constructorStandings ? 'JOLPICA / ERGAST' : 'CACHED SEED'}
                  accent="text-emerald-400"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KV({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex justify-between bg-white/5 p-2 rounded">
      <span className="text-on-surface-variant">{label}</span>
      <span className={`font-bold ${accent ?? 'text-on-surface'}`}>{value}</span>
    </div>
  );
}
