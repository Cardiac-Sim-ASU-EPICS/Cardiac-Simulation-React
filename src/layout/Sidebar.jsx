import React from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";

const EXPLORE_LINKS = [
  {
    to: "/ekg-waveforms",
    label: "EKG Waveforms",
    shortLabel: "EKG",
    icon: "/assets/icon-ekg-waveforms.svg",
  },
  {
    to: "/case-studies",
    label: "Case Studies",
    shortLabel: "Cases",
    icon: "/assets/icon-case-studies.svg",
  },
  {
    to: "/reviews",
    label: "Reviews",
    shortLabel: "Review",
    icon: "/assets/icon-reviews.svg",
  },
];

export default function Sidebar({ rhythms, activeId, collapsed, onToggleCollapsed }) {
  const navigate = useNavigate();

  return (
    <aside className="sidebar" aria-label="Sidebar navigation">
      <div className="sidebar__section">
        <div className="sidebar__label">Rhythms</div>

        <div className="sidebar__list" id="sidebar-list">
          {rhythms.map((r) => (
            <Link
              key={r.id}
              className={`sideitem ${activeId === r.id ? "sideitem--active" : ""}`}
              to={`/sim/${encodeURIComponent(r.id)}`}
              data-id={r.id}
            >
              <div className="sideitem__name">{r.name}</div>
              <div className="sideitem__tag">{r.tag}</div>
            </Link>
          ))}
        </div>
      </div>

      <div className="sidebar__section sidebar__section--explore">
        <div className="sidebar__label">Explore</div>

        <nav className="sidebar-nav" aria-label="Learning sections">
          {EXPLORE_LINKS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `sidebar-navitem${isActive ? " sidebar-navitem--active" : ""}`
              }
              aria-label={item.label}
              title={collapsed ? item.label : undefined}
            >
              <img className="sidebar-navitem__icon" src={item.icon} alt="" />
              <span className="sidebar-navitem__label">{item.label}</span>
              <span className="sidebar-navitem__short" aria-hidden="true">
                {item.shortLabel}
              </span>
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="sidebar__section sidebar__section--quick">
        <div className="sidebar__label">Quick tools</div>
        <button className="sidebar__btn" type="button" onClick={() => navigate("/")}>
          Go Home
        </button>
        <button
          className="sidebar__btn sidebar__btn--ghost"
          type="button"
          onClick={onToggleCollapsed}
        >
          {collapsed ? "Expand sidebar" : "Collapse sidebar"}
        </button>
      </div>
    </aside>
  );
}
