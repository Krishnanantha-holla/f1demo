import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, getTeamColor } from "../../api";
import {
  EmptyMsg,
  ErrorMsg,
  Loading,
  Skeleton,
  formatDate,
} from "../../components/Shared";

import { LiveBanner, LiveSession, NextRace, WeekendRadar } from "./components";
import {
  driverDisplay,
  eventFirstSessionDate,
  eventLastSessionDate,
  mergeDriverMaps,
} from "./utils";

/** Phase F: Above-the-fold 4-pane layout with independent widget loading */

// Top-right pane: Driver standings (top 5 only) with per-widget Skeleton
function DriverStandingsWidget({ drivers }) {
  const [data, setData] = useState([]);
  const [status, setStatus] = useState("loading");
  const navigate = useNavigate();

  useEffect(() => {
    api
      .driverStandings()
      .then((result) => {
        setData(result);
        setStatus(result.length ? "ok" : "empty");
      })
      .catch((err) => {
        console.warn("[DriverStandingsWidget]", err);
        setStatus("error");
      });
  }, []);

  const topFive = data.slice(0, 5);

  return (
    <div
      className="card clickable"
      onClick={() => navigate("/drivers")}
      style={{ minHeight: "280px" }}
    >
      <div className="card-header">
        <span className="card-title">Standings (Top 5)</span>
        <span className="click-hint">View all →</span>
      </div>
      <div className="card-body">
        {status === "loading" && (
          <>
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: "0.5rem",
                  marginBottom: "0.5rem",
                  alignItems: "center",
                }}
              >
                <Skeleton width="2rem" height="1.2rem" />
                <Skeleton width="100%" height="1.2rem" />
              </div>
            ))}
          </>
        )}
        {status === "error" && <ErrorMsg text="Failed to load standings." />}
        {status === "empty" && <EmptyMsg text="No standings yet." />}
        {status === "ok" && (
          <table className="data-table" style={{ fontSize: "0.85rem" }}>
            <thead>
              <tr>
                <th className="col-pos">P</th>
                <th>Driver</th>
                <th>Pts</th>
              </tr>
            </thead>
            <tbody>
              {topFive.map((standing) => {
                const driverNumber =
                  Number(
                    standing.driver_number ?? standing.Driver?.permanentNumber,
                  ) || null;
                const driver = driverNumber ? drivers[driverNumber] : null;
                const position =
                  standing.position_current ?? standing.position ?? "—";
                const points = standing.points_current ?? standing.points ?? 0;
                const teamColor = driver?.team_colour
                  ? `#${driver.team_colour}`
                  : "#999";
                return (
                  <tr key={driverNumber || standing.position}>
                    <td className="col-pos">{position}</td>
                    <td>
                      <div className="driver-cell" style={{ gap: "0.4rem" }}>
                        <span
                          className="team-dot"
                          style={{ background: teamColor }}
                        />
                        <span className="driver-info-name">
                          {driverDisplay(
                            driver,
                            `${standing.Driver?.givenName || ""} ${standing.Driver?.familyName || ""}`.trim(),
                          )}
                        </span>
                      </div>
                    </td>
                    <td className="col-pts">{points}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// Bottom-left pane: Last race podium
function LastRaceResultWidget() {
  const [race, setRace] = useState(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    api
      .lastResults()
      .then((result) => {
        setRace(result || null);
        setStatus(result?.Results?.length ? "ok" : "empty");
      })
      .catch(() => setStatus("error"));
  }, []);

  if (status === "loading") {
    return (
      <div className="card podium-card" style={{ minHeight: "280px" }}>
        <div className="card-header">
          <span className="card-title">Last Classified</span>
        </div>
        <div className="card-body">
          <Skeleton width="100%" height="220px" />
        </div>
      </div>
    );
  }
  if (status === "error" || status === "empty") return null;

  const topThree = race.Results.slice(0, 3);
  const podiumColors = ["#ffd166", "#d1d5db", "#d97706"];

  return (
    <div className="card podium-card">
      <div className="card-header">
        <span className="card-title">Last Classified</span>
        <span className="card-badge">{race.raceName}</span>
      </div>
      <div className="card-body">
        <div className="dash-podium refined">
          {topThree.map((result, index) => (
            <div
              key={result.Driver?.driverId || index}
              className="dash-podium-slot"
            >
              <div
                className="dash-podium-medal"
                style={{ color: podiumColors[index] }}
              >
                P{result.position}
              </div>
              <div className="dash-podium-name">
                {result.Driver?.code || result.Driver?.familyName}
              </div>
              <div className="dash-podium-team">{result.Constructor?.name}</div>
              <div className="dash-podium-time">
                {result.Time?.time || result.status}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Bottom-right pane: News headlines (4 only)
function NewsHeadlinesWidget() {
  const [articles, setArticles] = useState([]);
  const [status, setStatus] = useState("loading");
  const navigate = useNavigate();

  useEffect(() => {
    api
      .news()
      .then((result) => {
        setArticles((result || []).slice(0, 4));
        setStatus(result?.length ? "ok" : "empty");
      })
      .catch(() => setStatus("error"));
  }, []);

  if (status === "loading") {
    return (
      <div className="card" style={{ minHeight: "280px" }}>
        <div className="card-header">
          <span className="card-title">News</span>
        </div>
        <div className="card-body">
          {[...Array(4)].map((_, i) => (
            <div key={i} style={{ marginBottom: "1rem" }}>
              <Skeleton
                width="100%"
                height="1rem"
                style={{ marginBottom: "0.3rem" }}
              />
              <Skeleton width="80%" height="0.75rem" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">News</span>
        <span
          className="click-hint clickable"
          role="button"
          onClick={() => navigate("/news")}
        >
          More →
        </span>
      </div>
      <div className="card-body">
        {status === "empty" && <EmptyMsg text="No news yet." />}
        {status === "error" && <ErrorMsg text="Failed to load news." />}
        {status === "ok" && (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
          >
            {articles.map((article, i) => (
              <div key={i} style={{ fontSize: "0.85rem", lineHeight: "1.3" }}>
                <div
                  style={{
                    fontWeight: "500",
                    color: "var(--text-primary)",
                    marginBottom: "0.2rem",
                  }}
                >
                  {article.title}
                </div>
                <div
                  style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}
                >
                  {new Date(article.pubDate).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Full driver standings for below-the-fold
function DriverStandings({ drivers }) {
  const [data, setData] = useState([]);
  const [status, setStatus] = useState("loading");
  const navigate = useNavigate();

  useEffect(() => {
    api
      .driverStandings()
      .then((result) => {
        setData(result);
        setStatus(result.length ? "ok" : "empty");
      })
      .catch((err) => {
        console.warn("[DriverStandings]", err);
        setStatus("error");
      });
  }, []);

  return (
    <div className="card clickable" onClick={() => navigate("/drivers")}>
      <div className="card-header">
        <span className="card-title">Driver Standings</span>
        <span className="click-hint">View all →</span>
      </div>
      <div className="card-body">
        {status === "loading" && <Loading />}
        {status === "error" && (
          <ErrorMsg text="Failed to load driver standings." />
        )}
        {status === "empty" && (
          <EmptyMsg text="No driver standings available yet." />
        )}
        {status === "ok" && (
          <table className="data-table">
            <thead>
              <tr>
                <th className="col-pos">P</th>
                <th>Driver</th>
                <th>Team</th>
                <th className="col-pts">Pts</th>
              </tr>
            </thead>
            <tbody>
              {data.map((standing) => {
                const driverNumber =
                  Number(
                    standing.driver_number ?? standing.Driver?.permanentNumber,
                  ) || null;
                const driver = driverNumber ? drivers[driverNumber] : null;
                const position =
                  standing.position_current ?? standing.position ?? "—";
                const points = standing.points_current ?? standing.points ?? 0;
                const teamName =
                  standing.team_name ||
                  standing.Constructors?.[0]?.name ||
                  driver?.team_name ||
                  "";
                const teamColor = driver?.team_colour
                  ? `#${driver.team_colour}`
                  : getTeamColor(teamName);
                return (
                  <tr key={driverNumber || standing.position}>
                    <td className="col-pos">{position}</td>
                    <td>
                      <div className="driver-cell">
                        <span
                          className="team-dot"
                          style={{ background: teamColor }}
                        />
                        {driver?.headshot_url && (
                          <img
                            className="driver-headshot"
                            src={driver.headshot_url}
                            alt=""
                            loading="lazy"
                          />
                        )}
                        <span className="driver-info-name">
                          {driverDisplay(
                            driver,
                            `${standing.Driver?.givenName || ""} ${standing.Driver?.familyName || ""}`.trim(),
                          )}
                        </span>
                      </div>
                    </td>
                    <td
                      style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}
                    >
                      {teamName}
                    </td>
                    <td className="col-pts">{points}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function ConstructorStandings() {
  const [data, setData] = useState([]);
  const [status, setStatus] = useState("loading");
  const navigate = useNavigate();

  useEffect(() => {
    api
      .constructorStandings()
      .then((result) => {
        setData(result);
        setStatus(result.length ? "ok" : "empty");
      })
      .catch((err) => {
        console.warn("[ConstructorStandings]", err);
        setStatus("error");
      });
  }, []);

  return (
    <div className="card clickable" onClick={() => navigate("/constructors")}>
      <div className="card-header">
        <span className="card-title">Constructor Standings</span>
        <span className="click-hint">View all →</span>
      </div>
      <div className="card-body">
        {status === "loading" && <Loading />}
        {status === "error" && (
          <ErrorMsg text="Failed to load constructor standings." />
        )}
        {status === "empty" && (
          <EmptyMsg text="No constructor standings available yet." />
        )}
        {status === "ok" && (
          <table className="data-table">
            <thead>
              <tr>
                <th className="col-pos">P</th>
                <th>Constructor</th>
                <th className="col-pts">Pts</th>
              </tr>
            </thead>
            <tbody>
              {data.map((standing) => {
                const teamName =
                  standing.Constructor?.name || standing.team_name || "Unknown";
                const position =
                  standing.position_current ?? standing.position ?? "—";
                const points = standing.points_current ?? standing.points ?? 0;
                return (
                  <tr key={teamName}>
                    <td className="col-pos">{position}</td>
                    <td>
                      <div className="driver-cell">
                        <span
                          className="team-dot"
                          style={{ background: getTeamColor(teamName) }}
                        />
                        <span className="driver-info-name">{teamName}</span>
                      </div>
                    </td>
                    <td className="col-pts">{points}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function CalendarMini({ schedule, currentEvent }) {
  if (!schedule.length) return null;

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Season Map</span>
        <span className="card-badge">{schedule.length} Rounds</span>
      </div>
      <div className="card-body">
        <div className="calendar-grid enhanced-calendar-grid">
          {schedule.map((event) => {
            const active = currentEvent?.RoundNumber === event.RoundNumber;
            const complete = new Date(eventLastSessionDate(event)) < new Date();
            return (
              <div
                key={`${event.RoundNumber}-${event.EventName}`}
                className={`race-event ${active ? "next-up" : ""} ${complete ? "completed" : ""}`}
              >
                <div className="race-round">Round {event.RoundNumber}</div>
                <div className="race-event-name">{event.EventName}</div>
                <div className="race-event-loc">
                  {event.Location}, {event.Country}
                </div>
                <div className="race-event-date">
                  {formatDate(eventFirstSessionDate(event))} —{" "}
                  {formatDate(eventLastSessionDate(event))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Phase F: Main dashboard with glance-first redesign */
export default function Dashboard() {
  const [openF1Drivers, setOpenF1Drivers] = useState([]);
  const [freeRoster, setFreeRoster] = useState([]);
  const [freeContext, setFreeContext] = useState({ schedule: [] });
  const [modeMeta, setModeMeta] = useState({ mode: "idle" });

  const drivers = useMemo(
    () => mergeDriverMaps(openF1Drivers, freeRoster),
    [openF1Drivers, freeRoster],
  );

  // Phase F.1: Independent widget loading — no Promise.all blocking
  useEffect(() => {
    let cancelled = false;

    // Load drivers data
    api
      .drivers()
      .then((data) => {
        if (!cancelled) setOpenF1Drivers(data || []);
      })
      .catch(() => {});

    // Load roster data
    api
      .freeRoster()
      .then((data) => {
        if (!cancelled) setFreeRoster(data || []);
      })
      .catch(() => {});

    // Load context (schedule, current/next event)
    api
      .freeContext()
      .then((data) => {
        if (!cancelled) setFreeContext(data || { schedule: [] });
      })
      .catch(() => {});

    // Load session mode
    api
      .sessionMode()
      .then((data) => {
        if (!cancelled) setModeMeta(data || { mode: "idle" });
      })
      .catch(() => {});

    // Refresh dynamic data every 30s
    const refreshId = setInterval(() => {
      api
        .freeContext()
        .then((data) => {
          if (!cancelled) setFreeContext(data || { schedule: [] });
        })
        .catch(() => {});
      api
        .sessionMode()
        .then((data) => {
          if (!cancelled) setModeMeta(data || { mode: "idle" });
        })
        .catch(() => {});
    }, 30000);

    return () => {
      cancelled = true;
      clearInterval(refreshId);
    };
  }, []);

  const currentEvent = freeContext?.current_event || null;
  const nextEvent = freeContext?.next_event || null;
  const featuredEvent = currentEvent || nextEvent;

  return (
    <>
      <LiveBanner modeMeta={modeMeta} freeContext={freeContext} />
      <div className="page-header dashboard-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <div className="page-subtitle">
            Live weekend tracking with resilient fallback coverage.
          </div>
        </div>
        <span className="season-badge">Season {new Date().getFullYear()}</span>
      </div>

      {/* Phase F.3: Four-pane above-the-fold layout */}
      <div className="dash-grid-4">
        <div
          style={{
            animation: "cardEntrance 0.6s var(--ease-out-expo) 0s both",
          }}
        >
          <NextRace
            event={featuredEvent}
            currentSession={freeContext?.current_session}
            isWeekendLive={!!currentEvent}
          />
        </div>
        <div
          style={{
            animation: "cardEntrance 0.6s var(--ease-out-expo) 0.05s both",
          }}
        >
          <DriverStandingsWidget drivers={drivers} />
        </div>
        <div
          style={{
            animation: "cardEntrance 0.6s var(--ease-out-expo) 0.1s both",
          }}
        >
          <LastRaceResultWidget />
        </div>
        <div
          style={{
            animation: "cardEntrance 0.6s var(--ease-out-expo) 0.15s both",
          }}
        >
          <NewsHeadlinesWidget />
        </div>
      </div>

      {/* Below the fold: full standings and extended content */}
      <div
        className="standings-row"
        style={{
          animation: "cardEntrance 0.6s var(--ease-out-expo) 0.2s both",
        }}
      >
        <DriverStandings drivers={drivers} />
        <ConstructorStandings drivers={drivers} />
      </div>

      <div
        className="top-row"
        style={{
          animation: "cardEntrance 0.6s var(--ease-out-expo) 0.25s both",
        }}
      >
        <div className="top-row-left">
          <WeekendRadar freeContext={freeContext} modeMeta={modeMeta} />
        </div>
        <LiveSession
          drivers={drivers}
          modeMeta={modeMeta}
          freeContext={freeContext}
        />
      </div>

      <div className="bottom-dashboard-grid">
        <div
          style={{
            animation: "cardEntrance 0.6s var(--ease-out-expo) 0.3s both",
          }}
        >
          <CalendarMini
            schedule={freeContext?.schedule || []}
            currentEvent={currentEvent}
          />
        </div>
      </div>
    </>
  );
}
