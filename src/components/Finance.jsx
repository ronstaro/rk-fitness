import { useEffect, useMemo, useState } from "react";
import {
  createMonthlyPayment,
  createFinanceExpense,
  deleteMonthlyPayment,
  deleteFinanceExpense,
  fetchFinanceData,
  updateFinanceExpense,
  updateFinanceSettings,
  updateMonthlyPayment,
  updateMonthlyPaymentDetails,
} from "../services/financeService.js";

const PAYMENT_METHODS = ["העברה בנקאית", "ביט", "פייבוקס", "אשראי", "מזומן", "אחר"];

const EXPENSE_CATEGORIES = [
  "ציוד",
  "שכירות",
  "שיווק",
  "תוכנות",
  "הכשרה מקצועית",
  "נסיעות",
  "אחר",
];

function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function localDateKey(date = new Date()) {
  return `${monthKey(date)}-${String(date.getDate()).padStart(2, "0")}`;
}

function monthStart(value) {
  return `${value}-01`;
}

function moveMonth(value, amount) {
  const [year, month] = value.split("-").map(Number);
  return monthKey(new Date(year, month - 1 + amount, 1, 12));
}

function monthLabel(value, short = false) {
  const [year, month] = value.split("-").map(Number);
  return new Date(year, month - 1, 1, 12).toLocaleDateString("he-IL", {
    month: short ? "short" : "long",
    year: short ? "2-digit" : "numeric",
  });
}

function currency(value) {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function emptyExpense(selectedMonth) {
  const expenseDate = selectedMonth === monthKey()
    ? localDateKey()
    : `${selectedMonth}-01`;

  return {
    expenseDate,
    category: EXPENSE_CATEGORIES[0],
    description: "",
    amount: "",
    isRecognized: true,
  };
}

function emptyPayment(selectedMonth) {
  return {
    traineeId: "",
    traineeName: "",
    packageName: "",
    amount: "",
    paymentMethod: "",
    paymentStatus: "paid",
    paidAt: selectedMonth === monthKey() ? localDateKey() : `${selectedMonth}-01`,
  };
}

export default function Finance() {
  const [selectedMonth, setSelectedMonth] = useState(monthKey);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [rowError, setRowError] = useState("");
  const [rowActionId, setRowActionId] = useState(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentForm, setPaymentForm] = useState(() => emptyPayment(monthKey()));
  const [editingPaymentId, setEditingPaymentId] = useState(null);
  const [paymentError, setPaymentError] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expenseForm, setExpenseForm] = useState(() => emptyExpense(monthKey()));
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [expenseError, setExpenseError] = useState("");
  const [savingExpense, setSavingExpense] = useState(false);
  const [settingsForm, setSettingsForm] = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setLoadError("");
      setRowError("");

      try {
        const result = await fetchFinanceData(monthStart(selectedMonth));
        if (!active) return;
        setData(result);
        setSettingsForm({
          vatRate: String(result.settings.vat_rate),
          incomeTaxRate: String(result.settings.income_tax_rate),
          pricesIncludeVat: result.settings.prices_include_vat,
        });
      } catch (error) {
        console.error("Finance load error:", error);
        if (active) setLoadError("לא ניתן לטעון את נתוני הכספים כרגע.");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [reloadKey, selectedMonth]);

  const summary = useMemo(() => {
    if (!data) return null;

    const expected = data.payments.reduce(
      (total, payment) => total + Number(payment.amount),
      0
    );
    const received = data.payments
      .filter((payment) => payment.payment_status === "paid")
      .reduce((total, payment) => total + Number(payment.amount), 0);
    const unpaidPayments = data.payments.filter(
      (payment) => payment.payment_status === "unpaid"
    );
    const missingPricePayments = data.payments.filter(
      (payment) => Number(payment.amount) === 0
    );
    const pending = unpaidPayments.reduce(
      (total, payment) => total + Number(payment.amount),
      0
    );
    const expenses = data.expenses
      .filter((expense) => expense.is_recognized)
      .reduce((total, expense) => total + Number(expense.amount), 0);
    const vatRate = Number(data.settings.vat_rate);
    const vat = data.settings.prices_include_vat
      ? received * (vatRate / (100 + vatRate || 1))
      : received * (vatRate / 100);
    const taxable = Math.max(0, received - vat - expenses);
    const incomeTax = taxable * (Number(data.settings.income_tax_rate) / 100);
    const net = taxable - incomeTax;

    const trendByMonth = new Map();
    for (const payment of data.trendPayments) {
      const key = payment.billing_month.slice(0, 7);
      trendByMonth.set(key, (trendByMonth.get(key) || 0) + Number(payment.amount));
    }
    const trend = Array.from({ length: 12 }, (_, index) => {
      const key = moveMonth(selectedMonth, index - 11);
      return { key, value: trendByMonth.get(key) || 0 };
    });

    return {
      expected,
      received,
      unpaidPayments,
      missingPricePayments,
      pending,
      expenses,
      vat,
      incomeTax,
      net,
      trend,
      trendMax: Math.max(1, ...trend.map((item) => item.value)),
    };
  }, [data, selectedMonth]);

  function changeMonth(amount) {
    const nextMonth = moveMonth(selectedMonth, amount);
    if (nextMonth > monthKey()) return;
    setSelectedMonth(nextMonth);
    setShowExpenseForm(false);
    setShowPaymentForm(false);
    setEditingPaymentId(null);
    setPaymentForm(emptyPayment(nextMonth));
    setEditingExpenseId(null);
    setExpenseForm(emptyExpense(nextMonth));
  }

  function syncPaymentInState(saved, previous = null) {
    setData((current) => {
      const payments = previous
        ? current.payments.map((payment) => payment.id === saved.id ? saved : payment)
        : [...current.payments, saved].sort((a, b) => a.trainee_name.localeCompare(b.trainee_name, "he"));
      const trendPayments = current.trendPayments
        .filter((payment) => payment.billing_month !== saved.billing_month)
        .concat(payments.map((payment) => ({
          billing_month: payment.billing_month,
          amount: payment.amount,
        })));
      return { ...current, payments, trendPayments };
    });
  }

  function openNewPayment() {
    setEditingPaymentId(null);
    setPaymentForm(emptyPayment(selectedMonth));
    setPaymentError("");
    setShowPaymentForm(true);
  }

  function openPaymentEdit(payment) {
    setEditingPaymentId(payment.id);
    setPaymentForm({
      traineeId: payment.trainee_id || "",
      traineeName: payment.trainee_name,
      packageName: payment.package_name || "",
      amount: String(payment.amount),
      paymentMethod: payment.payment_method || "",
      paymentStatus: payment.payment_status,
      paidAt: payment.paid_at || `${selectedMonth}-01`,
    });
    setPaymentError("");
    setShowPaymentForm(true);
  }

  function handlePaymentTraineeChange(traineeId) {
    const trainee = data.activeTrainees.find((item) => item.id === traineeId);
    setPaymentForm((form) => ({
      ...form,
      traineeId,
      traineeName: trainee?.full_name || "",
      packageName: trainee?.package_name || form.packageName,
      amount: trainee?.package_price == null ? form.amount : String(trainee.package_price),
      paymentMethod: trainee?.payment_method || form.paymentMethod,
    }));
  }

  async function handlePaymentSave(event) {
    event.preventDefault();
    const amount = Number(paymentForm.amount);
    if (!paymentForm.traineeName.trim() || amount < 0 || !Number.isFinite(amount)) {
      setPaymentError("יש למלא שם וסכום תקין.");
      return;
    }
    if (paymentForm.paymentStatus === "paid" && !paymentForm.paidAt.startsWith(selectedMonth)) {
      setPaymentError("תאריך התשלום חייב להיות בחודש הנבחר.");
      return;
    }

    const payload = {
      trainee_id: paymentForm.traineeId || null,
      billing_month: monthStart(selectedMonth),
      trainee_name: paymentForm.traineeName.trim(),
      package_name: paymentForm.packageName.trim(),
      amount,
      payment_method: paymentForm.paymentMethod,
      payment_status: paymentForm.paymentStatus,
      paid_at: paymentForm.paymentStatus === "paid" ? paymentForm.paidAt : null,
    };

    setSavingPayment(true);
    setPaymentError("");
    try {
      if (editingPaymentId) {
        const previous = data.payments.find((payment) => payment.id === editingPaymentId);
        const saved = await updateMonthlyPaymentDetails(editingPaymentId, payload);
        syncPaymentInState(saved, previous);
      } else {
        const saved = await createMonthlyPayment(payload);
        syncPaymentInState(saved);
      }
      setShowPaymentForm(false);
      setEditingPaymentId(null);
    } catch (error) {
      console.error("Monthly payment save error:", error);
      setPaymentError("לא ניתן לשמור את ההכנסה. ייתכן שכבר קיימת שורה למתאמן בחודש הזה.");
    } finally {
      setSavingPayment(false);
    }
  }

  async function handlePaymentDelete(payment) {
    if (!window.confirm(`למחוק את שורת ההכנסה של ${payment.trainee_name}?`)) return;
    setRowActionId(payment.id);
    setRowError("");
    try {
      await deleteMonthlyPayment(payment);
      setData((current) => {
        const payments = current.payments.filter((item) => item.id !== payment.id);
        return {
          ...current,
          payments,
          trendPayments: current.trendPayments
            .filter((item) => item.billing_month !== payment.billing_month)
            .concat(payments.map((item) => ({
              billing_month: item.billing_month,
              amount: item.amount,
            }))),
        };
      });
    } catch (error) {
      console.error("Monthly payment delete error:", error);
      setRowError("לא ניתן למחוק את שורת ההכנסה. נסה שוב.");
    } finally {
      setRowActionId(null);
    }
  }

  async function handlePaymentStatus(payment, status) {
    if (rowActionId) return;
    setRowActionId(payment.id);
    setRowError("");

    try {
      const updated = await updateMonthlyPayment(payment.id, status);
      setData((current) => ({
        ...current,
        payments: current.payments.map((item) =>
          item.id === payment.id ? updated : item
        ),
      }));
    } catch (error) {
      console.error("Monthly payment update error:", error);
      setRowError("לא ניתן לעדכן את סטטוס התשלום. נסה שוב.");
    } finally {
      setRowActionId(null);
    }
  }

  function openNewExpense() {
    setEditingExpenseId(null);
    setExpenseForm(emptyExpense(selectedMonth));
    setExpenseError("");
    setShowExpenseForm(true);
  }

  function openExpenseEdit(expense) {
    setEditingExpenseId(expense.id);
    setExpenseForm({
      expenseDate: expense.expense_date,
      category: expense.category,
      description: expense.description || "",
      amount: String(expense.amount),
      isRecognized: expense.is_recognized,
    });
    setExpenseError("");
    setShowExpenseForm(true);
  }

  async function handleExpenseSave(event) {
    event.preventDefault();
    const amount = Number(expenseForm.amount);
    if (
      !expenseForm.expenseDate.startsWith(selectedMonth) ||
      !expenseForm.category ||
      amount <= 0
    ) {
      setExpenseError("יש למלא תאריך, קטגוריה וסכום גדול מאפס.");
      return;
    }

    setSavingExpense(true);
    setExpenseError("");
    const payload = {
      billing_month: monthStart(selectedMonth),
      expense_date: expenseForm.expenseDate,
      category: expenseForm.category,
      description: expenseForm.description.trim(),
      amount,
      is_recognized: expenseForm.isRecognized,
    };

    try {
      if (editingExpenseId) {
        const updated = await updateFinanceExpense(editingExpenseId, payload);
        setData((current) => ({
          ...current,
          expenses: current.expenses.map((expense) =>
            expense.id === editingExpenseId ? updated : expense
          ),
        }));
      } else {
        const created = await createFinanceExpense(payload);
        setData((current) => ({
          ...current,
          expenses: [created, ...current.expenses],
        }));
      }
      setShowExpenseForm(false);
      setEditingExpenseId(null);
    } catch (error) {
      console.error("Finance expense save error:", error);
      setExpenseError("לא ניתן לשמור את ההוצאה. נסה שוב.");
    } finally {
      setSavingExpense(false);
    }
  }

  async function handleExpenseDelete(expense) {
    if (!window.confirm("למחוק את ההוצאה הזו?")) return;
    setRowActionId(expense.id);
    setRowError("");

    try {
      await deleteFinanceExpense(expense.id);
      setData((current) => ({
        ...current,
        expenses: current.expenses.filter((item) => item.id !== expense.id),
      }));
    } catch (error) {
      console.error("Finance expense delete error:", error);
      setRowError("לא ניתן למחוק את ההוצאה. נסה שוב.");
    } finally {
      setRowActionId(null);
    }
  }

  async function handleSettingsSave(event) {
    event.preventDefault();
    const vatRate = Number(settingsForm.vatRate);
    const incomeTaxRate = Number(settingsForm.incomeTaxRate);
    if (
      vatRate < 0 ||
      vatRate > 100 ||
      incomeTaxRate < 0 ||
      incomeTaxRate > 100
    ) {
      setSettingsMessage("האחוזים חייבים להיות בין 0 ל־100.");
      return;
    }

    setSavingSettings(true);
    setSettingsMessage("");
    try {
      const settings = await updateFinanceSettings({
        vat_rate: vatRate,
        income_tax_rate: incomeTaxRate,
        prices_include_vat: settingsForm.pricesIncludeVat,
      });
      setData((current) => ({ ...current, settings }));
      setSettingsMessage("ההגדרות נשמרו.");
    } catch (error) {
      console.error("Finance settings update error:", error);
      setSettingsMessage("לא ניתן לשמור את ההגדרות כרגע.");
    } finally {
      setSavingSettings(false);
    }
  }

  if (loading) {
    return <div className="finance-state">טוען נתוני כספים...</div>;
  }

  if (loadError || !data || !summary) {
    return (
      <div className="finance-state">
        <div className="finance-error">{loadError}</div>
        <button type="button" className="btn btn-primary" onClick={() => setReloadKey((key) => key + 1)}>
          נסה שוב
        </button>
      </div>
    );
  }

  return (
    <div className="finance-page">
      <header className="finance-page-header">
        <div>
          <h2>כספים</h2>
          <p>צפי הכנסות, גבייה, הוצאות ונטו משוער</p>
        </div>
        <div className="finance-month-nav" aria-label="בחירת חודש">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => changeMonth(-1)}>→</button>
          <strong>{monthLabel(selectedMonth)}</strong>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => changeMonth(1)}
            disabled={selectedMonth >= monthKey()}
          >
            ←
          </button>
        </div>
      </header>

      {summary.unpaidPayments.length > 0 && (
        <section className="finance-collection-alert" role="alert">
          <span>⚠️</span>
          <div>
            <strong>{summary.unpaidPayments.length} תשלומים דורשים גבייה</strong>
            <p>סה״כ {currency(summary.pending)} טרם התקבלו בחודש הנבחר.</p>
          </div>
        </section>
      )}

      {summary.missingPricePayments.length > 0 && (
        <section className="finance-data-alert" role="status">
          <strong>חסר מחיר חבילה ל־{summary.missingPricePayments.length} מתאמנים.</strong>
          <span>הצפי יתעדכן לאחר השלמת המחיר בפרופיל המתאמן.</span>
        </section>
      )}

      {rowError && <div className="alert-strip danger">{rowError}</div>}

      <section className="finance-metrics" aria-label="סיכום כספי חודשי">
        <article className="metric burg">
          <div className="metric-label">צפי הכנסות</div>
          <div className="metric-value">{currency(summary.expected)}</div>
          <div className="metric-sub">לפי {data.payments.length} מתאמנים בחודש</div>
        </article>
        <article className="metric">
          <div className="metric-label">התקבל בפועל</div>
          <div className="metric-value">{currency(summary.received)}</div>
          <div className="metric-sub">רק תשלומים שסומנו שולם</div>
        </article>
        <article className={`metric${summary.pending > 0 ? " mustard" : ""}`}>
          <div className="metric-label">ממתין לגבייה</div>
          <div className="metric-value">{currency(summary.pending)}</div>
          <div className="metric-sub">{summary.unpaidPayments.length} מתאמנים</div>
        </article>
        <article className="metric">
          <div className="metric-label">הוצאות מוכרות</div>
          <div className="metric-value">{currency(summary.expenses)}</div>
          <div className="metric-sub">לפי ההוצאות שסומנו כמוכרות</div>
        </article>
        <article className="metric burg finance-net-metric">
          <div className="metric-label">נטו משוער</div>
          <div className="metric-value">{currency(summary.net)}</div>
          <div className="metric-sub">לאחר מע״מ, מס משוער והוצאות</div>
        </article>
      </section>

      <div className="finance-main-grid">
        <section className="card finance-panel finance-trend-panel">
          <div className="finance-panel-heading">
            <div>
              <h3>מגמת צפי הכנסות</h3>
              <p>לפי מחיר החבילה החודשי, ללא תלות בסטטוס התשלום</p>
            </div>
          </div>
          <div className="finance-chart" aria-label="צפי הכנסות ב־12 החודשים האחרונים">
            {summary.trend.map((item) => (
              <div className="finance-chart-column" key={item.key} title={`${monthLabel(item.key)}: ${currency(item.value)}`}>
                <span className="finance-chart-value">{item.value > 0 ? currency(item.value) : ""}</span>
                <div className="finance-chart-track">
                  <div className="finance-chart-bar" style={{ height: `${Math.max(item.value > 0 ? 8 : 0, (item.value / summary.trendMax) * 100)}%` }} />
                </div>
                <span>{monthLabel(item.key, true)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card finance-panel finance-summary-panel">
          <div className="finance-panel-heading">
            <div>
              <h3>חישוב ברוטו–נטו</h3>
              <p>הערכה ניהולית לחודש הנבחר</p>
            </div>
          </div>
          <dl className="finance-summary-list">
            <div><dt>ברוטו שהתקבל</dt><dd>{currency(summary.received)}</dd></div>
            <div><dt>מע״מ משוער</dt><dd>− {currency(summary.vat)}</dd></div>
            <div><dt>הוצאות מוכרות</dt><dd>− {currency(summary.expenses)}</dd></div>
            <div><dt>מס הכנסה משוער</dt><dd>− {currency(summary.incomeTax)}</dd></div>
            <div className="finance-summary-total"><dt>נטו משוער</dt><dd>{currency(summary.net)}</dd></div>
          </dl>
          <p className="finance-disclaimer">החישוב הוא כלי ניהולי בלבד ואינו דוח חשבונאי.</p>
        </section>
      </div>

      <section className="card finance-panel finance-payments-panel">
        <div className="finance-panel-heading">
          <div>
            <h3>פירוט חודשי לפי מתאמן</h3>
            <p>ברירת המחדל בחודש הנוכחי היא שולם לפי החבילה בפרופיל</p>
          </div>
          <button type="button" className="btn btn-primary btn-sm" onClick={openNewPayment}>+ הוספת הכנסה</button>
        </div>
        {showPaymentForm && (
          <form className="finance-payment-form" onSubmit={handlePaymentSave}>
            <div className="form-group">
              <label className="form-label">מתאמן קיים</label>
              <select className="form-select" value={paymentForm.traineeId} onChange={(event) => handlePaymentTraineeChange(event.target.value)}>
                <option value="">הזנה ידנית</option>
                {data.activeTrainees.map((trainee) => <option key={trainee.id} value={trainee.id}>{trainee.full_name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">שם *</label>
              <input className="form-input" value={paymentForm.traineeName} disabled={Boolean(paymentForm.traineeId)} onChange={(event) => setPaymentForm((form) => ({ ...form, traineeName: event.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">חבילה</label>
              <input className="form-input" value={paymentForm.packageName} onChange={(event) => setPaymentForm((form) => ({ ...form, packageName: event.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">סכום *</label>
              <input className="form-input" type="number" min="0" step="0.01" value={paymentForm.amount} onChange={(event) => setPaymentForm((form) => ({ ...form, amount: event.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">אמצעי תשלום</label>
              <select className="form-select" value={paymentForm.paymentMethod} onChange={(event) => setPaymentForm((form) => ({ ...form, paymentMethod: event.target.value }))}>
                <option value="">לא הוגדר</option>
                {PAYMENT_METHODS.map((method) => <option key={method}>{method}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">סטטוס</label>
              <select className="form-select" value={paymentForm.paymentStatus} onChange={(event) => setPaymentForm((form) => ({ ...form, paymentStatus: event.target.value }))}>
                <option value="paid">שולם</option>
                <option value="unpaid">לא שולם</option>
              </select>
            </div>
            {paymentForm.paymentStatus === "paid" && <div className="form-group">
              <label className="form-label">תאריך תשלום</label>
              <input className="form-input" type="date" min={`${selectedMonth}-01`} max={`${selectedMonth}-31`} value={paymentForm.paidAt} onChange={(event) => setPaymentForm((form) => ({ ...form, paidAt: event.target.value }))} />
            </div>}
            {paymentError && <div className="finance-form-error">{paymentError}</div>}
            <div className="finance-form-actions">
              <button type="submit" className="btn btn-primary btn-sm" disabled={savingPayment}>{savingPayment ? "שומר..." : editingPaymentId ? "שמירת שינויים" : "הוספת הכנסה"}</button>
              <button type="button" className="btn btn-ghost btn-sm" disabled={savingPayment} onClick={() => setShowPaymentForm(false)}>ביטול</button>
            </div>
          </form>
        )}
        {data.payments.length === 0 ? (
          <div className="finance-empty">אין נתוני תשלום לחודש הזה.</div>
        ) : (
          <div className="finance-table-wrap">
            <table className="table finance-table">
              <thead>
                <tr>
                  <th>מתאמן</th>
                  <th>חבילה</th>
                  <th>סכום</th>
                  <th>אמצעי תשלום</th>
                  <th>סטטוס חודשי</th>
                  <th>תאריך תשלום</th>
                  <th>פעולות</th>
                </tr>
              </thead>
              <tbody>
                {data.payments.map((payment) => {
                  const unpaid = payment.payment_status === "unpaid";
                  const busy = rowActionId === payment.id;
                  return (
                    <tr key={payment.id} className={unpaid ? "finance-payment-unpaid" : ""}>
                      <td><strong>{payment.trainee_name}</strong></td>
                      <td>{payment.package_name || "לא הוגדרה"}</td>
                      <td>
                        {Number(payment.amount) === 0 ? (
                          <span className="badge badge-warn">מחיר חסר</span>
                        ) : (
                          currency(payment.amount)
                        )}
                      </td>
                      <td>{payment.payment_method || "לא הוגדר"}</td>
                      <td>
                        <select
                          className={`form-select finance-status-select${unpaid ? " unpaid" : ""}`}
                          value={payment.payment_status}
                          onChange={(event) => handlePaymentStatus(payment, event.target.value)}
                          disabled={Boolean(rowActionId)}
                          aria-label={`סטטוס תשלום עבור ${payment.trainee_name}`}
                        >
                          <option value="paid">שולם</option>
                          <option value="unpaid">לא שולם</option>
                        </select>
                        {busy && <small className="finance-row-saving">שומר...</small>}
                      </td>
                      <td>{payment.paid_at ? new Date(`${payment.paid_at}T12:00:00`).toLocaleDateString("he-IL") : "—"}</td>
                      <td>
                        <div className="finance-row-actions">
                          <button type="button" className="btn btn-ghost btn-sm" disabled={Boolean(rowActionId)} onClick={() => openPaymentEdit(payment)}>עריכה</button>
                          <button type="button" className="btn btn-danger btn-sm" disabled={Boolean(rowActionId)} onClick={() => handlePaymentDelete(payment)}>מחיקה</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card finance-panel finance-expenses-panel">
        <div className="finance-panel-heading">
          <div>
            <h3>הוצאות</h3>
            <p>הוצאות עסקיות לחודש הנבחר</p>
          </div>
          <button type="button" className="btn btn-primary btn-sm" onClick={openNewExpense}>+ הוספת הוצאה</button>
        </div>

        {showExpenseForm && (
          <form className="finance-expense-form" onSubmit={handleExpenseSave}>
            <div className="form-group">
              <label className="form-label">תאריך</label>
              <input className="form-input" type="date" value={expenseForm.expenseDate} min={`${selectedMonth}-01`} max={`${selectedMonth}-31`} onChange={(event) => setExpenseForm((form) => ({ ...form, expenseDate: event.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">קטגוריה</label>
              <select className="form-select" value={expenseForm.category} onChange={(event) => setExpenseForm((form) => ({ ...form, category: event.target.value }))}>
                {EXPENSE_CATEGORIES.map((category) => <option key={category}>{category}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">סכום</label>
              <input className="form-input" type="number" min="0.01" step="0.01" value={expenseForm.amount} onChange={(event) => setExpenseForm((form) => ({ ...form, amount: event.target.value }))} />
            </div>
            <div className="form-group finance-expense-description">
              <label className="form-label">תיאור</label>
              <input className="form-input" value={expenseForm.description} onChange={(event) => setExpenseForm((form) => ({ ...form, description: event.target.value }))} />
            </div>
            <label className="finance-checkbox">
              <input type="checkbox" checked={expenseForm.isRecognized} onChange={(event) => setExpenseForm((form) => ({ ...form, isRecognized: event.target.checked }))} />
              הוצאה מוכרת
            </label>
            {expenseError && <div className="finance-form-error">{expenseError}</div>}
            <div className="finance-form-actions">
              <button type="submit" className="btn btn-primary btn-sm" disabled={savingExpense}>{savingExpense ? "שומר..." : editingExpenseId ? "שמירת שינויים" : "הוספת הוצאה"}</button>
              <button type="button" className="btn btn-ghost btn-sm" disabled={savingExpense} onClick={() => setShowExpenseForm(false)}>ביטול</button>
            </div>
          </form>
        )}

        {data.expenses.length === 0 ? (
          <div className="finance-empty">לא נוספו הוצאות בחודש הזה.</div>
        ) : (
          <div className="finance-expense-list">
            {data.expenses.map((expense) => (
              <div className="finance-expense-row" key={expense.id}>
                <div>
                  <strong>{expense.category}</strong>
                  <span>{expense.description || "ללא תיאור"} · {new Date(`${expense.expense_date}T12:00:00`).toLocaleDateString("he-IL")}</span>
                </div>
                <div className="finance-expense-end">
                  {!expense.is_recognized && <span className="badge badge-inactive">לא מוכרת</span>}
                  <strong>{currency(expense.amount)}</strong>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => openExpenseEdit(expense)} disabled={Boolean(rowActionId)}>עריכה</button>
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => handleExpenseDelete(expense)} disabled={Boolean(rowActionId)}>מחיקה</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {settingsForm && (
        <section className="card finance-panel">
          <div className="finance-panel-heading">
            <div>
              <h3>הגדרות חישוב</h3>
              <p>האחוזים משפיעים על הערכת הנטו בלבד</p>
            </div>
          </div>
          <form className="finance-settings-form" onSubmit={handleSettingsSave}>
            <div className="form-group">
              <label className="form-label">מע״מ (%)</label>
              <input className="form-input" type="number" min="0" max="100" step="0.01" value={settingsForm.vatRate} onChange={(event) => setSettingsForm((form) => ({ ...form, vatRate: event.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">מס הכנסה משוער (%)</label>
              <input className="form-input" type="number" min="0" max="100" step="0.01" value={settingsForm.incomeTaxRate} onChange={(event) => setSettingsForm((form) => ({ ...form, incomeTaxRate: event.target.value }))} />
            </div>
            <label className="finance-checkbox">
              <input type="checkbox" checked={settingsForm.pricesIncludeVat} onChange={(event) => setSettingsForm((form) => ({ ...form, pricesIncludeVat: event.target.checked }))} />
              מחירי החבילות כוללים מע״מ
            </label>
            <button type="submit" className="btn btn-outline btn-sm" disabled={savingSettings}>{savingSettings ? "שומר..." : "שמירת הגדרות"}</button>
            {settingsMessage && <span className="finance-settings-message">{settingsMessage}</span>}
          </form>
        </section>
      )}
    </div>
  );
}
