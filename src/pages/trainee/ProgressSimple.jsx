const weeklyProgress = [
  { day: 'ראשון', label: 'Upper Body', value: 100 },
  { day: 'שני', label: 'הליכה / מוביליטי', value: 70 },
  { day: 'רביעי', label: 'Lower Body', value: 100 },
  { day: 'שישי', label: 'אימון מתוכנן', value: 30 },
];

const achievements = [
  'השלמת 3 אימונים השבוע',
  'שיפור התמדה לעומת השבוע שעבר',
  'שמירה על טכניקה טובה בלחיצת כתף',
];

export default function ProgressSimple() {
  return (
    <div className="workout-mobile">
      <div className="page-header">
        <div className="page-header-title">ההתקדמות שלי</div>
        <div className="page-header-sub">סיכום פשוט של השבוע והחודש</div>
      </div>

      <div className="metric-grid mb-16">
        <div className="metric burg">
          <div className="metric-label">יעד שבועי</div>
          <div className="metric-value">3/4</div>
          <div className="metric-sub">אימונים</div>
        </div>

        <div className="metric mustard">
          <div className="metric-label">התמדה חודשית</div>
          <div className="metric-value">75%</div>
          <div className="metric-sub">מהתוכנית בוצע</div>
        </div>
      </div>

      <div className="card mb-16">
        <div className="section-title">יעד שבועי</div>
        <div className="text-sm muted mb-12">ביצעת 3 מתוך 4 אימונים השבוע.</div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: '75%' }} />
        </div>
      </div>

      <div className="card mb-16">
        <div className="section-title">התמדה חודשית</div>
        <div className="text-sm muted mb-12">החודש את עומדת על 75% התמדה.</div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: '75%' }} />
        </div>
      </div>

      <div className="card mb-16">
        <div className="section-title">התקדמות שבועית</div>
        <div className="stack-sm">
          {weeklyProgress.map(item => (
            <div className="card-sm" key={item.day}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                <div>
                  <div className="text-sm" style={{ fontWeight: 700 }}>{item.day}</div>
                  <div className="text-xs muted">{item.label}</div>
                </div>
                <div className="text-sm muted">{item.value}%</div>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${item.value}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card mb-16">
        <div className="section-title">הישגים אחרונים</div>
        <div className="stack-sm">
          {achievements.map(item => (
            <div className="today-card" key={item}>
              <div className="today-card-content">
                <div className="today-card-title">🏆 {item}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card-sm">
        <div className="section-title">משוב אחרון מרוני</div>
        <div className="text-sm muted">
          עבודה מעולה השבוע. רואים שיפור בהתמדה ובשליטה בתרגילים. באימון הבא נמשיך לחזק את הטכניקה ונעלה עומס בהדרגה.
        </div>
      </div>
    </div>
  );
}
