import { BURG } from '../data/mockData.js';

function SLink({ icon, label, view, current, onClick, badge = 0 }) {
  return (
    <div
      className={`slink${current === view ? ' active' : ''}`}
      onClick={() => onClick(view)}
    >
      <span>{icon}</span>
      <span>{label}</span>
      {badge > 0 && <span className="slink-badge">{badge}</span>}
    </div>
  );
}

function Topbar({ title, role, lang, setLang, switchRole, notifCount, onNotif }) {
  return (
    <div className="topbar">
      <div className="topbar-title">{title}</div>

      <div className="topbar-right">
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setLang(lang === 'he' ? 'en' : 'he')}
        >
          {lang === 'he' ? 'EN' : 'עב'}
        </button>

        <button
          className="btn btn-ghost btn-sm"
          style={{ position: 'relative' }}
          onClick={onNotif}
        >
          🔔
          {notifCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: 2,
                right: 2,
                background: BURG,
                color: '#fff',
                borderRadius: '50%',
                width: 15,
                height: 15,
                fontSize: 9,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {notifCount}
            </span>
          )}
        </button>

        <button
          className="nav-role-btn"
          onClick={() => switchRole(role === 'admin' ? 'trainee' : 'admin')}
        >
          {role === 'admin' ? 'מעבר למתאמן' : 'מעבר למנהלת'}
        </button>
      </div>
    </div>
  );
}

function AdminSidebar({ adminSections, view, onNav, switchRole }) {
  return (
    <div className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-logo">R.K Fitness</div>
        <div className="sidebar-sub">Roni Kalisker</div>
      </div>

      {adminSections.map(section => (
        <div key={section.label}>
          <div className="sidebar-section">{section.label}</div>

          {section.links.map(link => (
            <SLink
              key={link.view}
              icon={link.icon}
              label={link.label}
              view={link.view}
              current={view}
              onClick={onNav}
              badge={link.badge || 0}
            />
          ))}
        </div>
      ))}

      <div className="sidebar-bottom">
        <button
          className="nav-role-btn"
          style={{ width: '100%' }}
          onClick={() => switchRole('trainee')}
        >
          מעבר לצד מתאמן ▶
        </button>
      </div>
    </div>
  );
}

function MobileNav({ traineeLinks, view, onNav }) {
  return (
    <nav className="mobile-nav">
      <div className="mobile-nav-inner">
        {traineeLinks.map(link => (
          <button
            key={link.view}
            className={`mobile-nav-btn${view === link.view ? ' active' : ''}`}
            onClick={() => onNav(link.view)}
            style={{ position: 'relative' }}
          >
            <span className="mobile-nav-icon">{link.icon}</span>
            <span>{link.label}</span>

            {link.badge > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: 2,
                  right: 4,
                  background: BURG,
                  color: '#fff',
                  borderRadius: '50%',
                  width: 14,
                  height: 14,
                  fontSize: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {link.badge}
              </span>
            )}
          </button>
        ))}
      </div>
    </nav>
  );
}

export default function Layout({
  role,
  view,
  lang,
  setLang,
  switchRole,
  notifCount,
  onNotif,
  adminSections,
  traineeLinks,
  onNav,
  children,
}) {
  if (role === 'admin') {
    return (
      <div className="app">
        <AdminSidebar
          adminSections={adminSections}
          view={view}
          onNav={onNav}
          switchRole={switchRole}
        />

        <div className="main">
          <Topbar
            title="R.K Fitness"
            role={role}
            lang={lang}
            setLang={setLang}
            switchRole={switchRole}
            notifCount={notifCount}
            onNotif={onNotif}
          />

          <div className="page">{children}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="app trainee-shell">
      <div className="main">
        <Topbar
          title="R.K Fitness"
          role={role}
          lang={lang}
          setLang={setLang}
          switchRole={switchRole}
          notifCount={notifCount}
          onNotif={onNotif}
        />

        <div className="page">{children}</div>
      </div>

      <MobileNav traineeLinks={traineeLinks} view={view} onNav={onNav} />
    </div>
  );
}