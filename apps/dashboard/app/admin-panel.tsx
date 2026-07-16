"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useI18n } from "./i18n";
import UpgradeAvailabilityPanel from "./upgrade-availability-panel";

type Account = { id: string; label: string; playerTag: string; color: string; sourceUrl: string; hasApiKey: boolean };
type Upgrade = { id: string; accountId: string; name: string; type: string; level: number; nextLevel: number; finishAt: string; status: string };
type ExportPreview = {
  tag: string; exportedAt: string; townHall: number; builders: { total: number; free: number; regularTotal?: number };
  upgradeSlots?: {
    laboratory: { available: boolean; active?: number; total?: number } | null;
    petHouse: { available: boolean } | null;
    builderBase: { builders: { total: number; free: number }; laboratory: { available: boolean; active?: number; total?: number } | null } | null;
  };
  upgrades: Array<{ id: string; name: string; type: string; level: number; nextLevel: number; finishAt: string }>;
  unknownDataIds: number[]; account: { id: string; label: string; color: string } | null; isNew: boolean;
};

const blankUpgrade = { accountId: "", name: "", type: "building", level: "0", nextLevel: "1", remainingHours: "1" };

export default function AdminPanel({ apiBase, onChanged }: { apiBase: string; onChanged: () => void }) {
  const { isKorean: ko, formatDateTime } = useI18n();
  const [token, setToken] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [upgrades, setUpgrades] = useState<Upgrade[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [section, setSection] = useState<"import" | "manual" | "villages">("import");
  const [exportText, setExportText] = useState("");
  const [preview, setPreview] = useState<ExportPreview | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [upgrade, setUpgrade] = useState(blankUpgrade);
  const [editing, setEditing] = useState<Account | null>(null);
  const [accountForm, setAccountForm] = useState({ label: "", color: "#4c9a79", sourceUrl: "", apiKey: "" });

  const request = useCallback(async (path: string, init: RequestInit = {}) => {
    const response = await fetch(`${apiBase}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers } });
    const result = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    if (response.status === 401) {
      localStorage.removeItem("multi-coc-admin-token");
      setToken("");
      throw new Error(ko ? "저장된 관리자 토큰이 현재 서버와 일치하지 않습니다. 다시 로그인하세요." : "The saved admin token no longer matches this server. Sign in again.");
    }
    if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
    return result;
  }, [apiBase, ko, token]);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [accountResult, upgradeResult] = await Promise.all([request("/api/admin/accounts"), request("/api/admin/upgrades")]);
      setAccounts(accountResult.accounts); setUpgrades(upgradeResult.upgrades); setError("");
    } catch (reason) { setError((reason as Error).message); }
  }, [request, token]);

  useEffect(() => {
    const timer = window.setTimeout(() => setToken(localStorage.getItem("multi-coc-admin-token") || ""), 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!token) return;
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [load, token]);

  const run = async (action: () => Promise<unknown>, success: string) => {
    try { setError(""); const result = await action(); setMessage(success); await load(); onChanged(); return result; }
    catch (reason) { setMessage(""); setError((reason as Error).message); return null; }
  };

  const chooseAccount = (item: Account) => {
    setEditing(item);
    setAccountForm({ label: item.label, color: item.color, sourceUrl: item.sourceUrl, apiKey: "" });
  };

  if (!token) return <section className="admin-shell"><div className="admin-login"><p className="eyebrow">ADMIN</p><h1>{ko ? "관리자 인증" : "Admin authentication"}</h1><p>{ko ? "docker/.env의 ADMIN_TOKEN을 입력하세요. POSTGRES_PASSWORD는 DB 전용이라 로그인에 사용할 수 없습니다." : "Enter ADMIN_TOKEN from docker/.env. POSTGRES_PASSWORD is database-only and cannot sign in here."}</p>{error && <p className="admin-alert error">{error}</p>}<form onSubmit={(event) => { event.preventDefault(); const value = String(new FormData(event.currentTarget).get("token") || "").trim(); setError(""); setMessage(""); localStorage.setItem("multi-coc-admin-token", value); setToken(value); }}><input name="token" type="password" required autoComplete="current-password" autoFocus /><button>{ko ? "로그인" : "Sign in"}</button></form></div></section>;

  return <section className="admin-shell">
    <div className="admin-title"><div><p className="eyebrow">VILLAGE DATA</p><h1>{ko ? "마을 데이터 관리" : "Village data"}</h1></div><button className="secondary" onClick={() => { localStorage.removeItem("multi-coc-admin-token"); setToken(""); }}>{ko ? "로그아웃" : "Sign out"}</button></div>
    <div className="admin-sections">
      <button className={section === "import" ? "active" : ""} onClick={() => setSection("import")}>{ko ? "데이터 업데이트" : "Update data"}</button>
      <button className={section === "manual" ? "active" : ""} onClick={() => setSection("manual")}>{ko ? "수동 보정" : "Manual adjustment"}</button>
      <button className={section === "villages" ? "active" : ""} onClick={() => setSection("villages")}>{ko ? "마을 관리" : "Manage villages"}</button>
    </div>
    {error && <p className="admin-alert error">{error}</p>}{message && <p className="admin-alert">{message}</p>}

    {section === "import" && <div className="import-flow">
      <article className="admin-card export-card primary-card"><p className="step-label">01 · PASTE</p><h2>{ko ? "게임 JSON 붙여넣기" : "Paste game JSON"}</h2><p>{ko ? "마을을 선택할 필요가 없습니다. JSON의 플레이어 태그로 자동 식별합니다." : "No village selection is needed. The player tag identifies it automatically."}</p>
        <textarea value={exportText} onChange={(event) => { setExportText(event.target.value); setPreview(null); setMessage(""); setError(""); }} placeholder='{"tag":"#...","timestamp":...}' autoFocus />
        <button disabled={!exportText.trim()} onClick={async () => {
          try { setError(""); setMessage(""); setPreview(await request("/api/admin/village-export/preview", { method: "POST", body: JSON.stringify({ exportText }) })); }
          catch (reason) { setPreview(null); setError((reason as Error).message); }
        }}>{ko ? "내용 확인" : "Review data"}</button>
      </article>

      {preview && <article className="admin-card preview-card"><p className="step-label">02 · REVIEW</p><div className="preview-heading"><div><h2>{preview.account?.label || (ko ? "새 마을" : "New village")}</h2><p>{preview.tag} · TH {preview.townHall} · {formatDateTime(preview.exportedAt)}</p></div><span className={preview.isNew ? "new-badge" : "match-badge"}>{preview.isNew ? (ko ? "신규" : "NEW") : (ko ? "등록됨" : "MATCHED")}</span></div>
        <div className="preview-stats compact"><div><span>{ko ? "진행 중" : "In progress"}</span><b>{preview.upgrades.length}</b></div><div><span>{ko ? "알 수 없는 항목" : "Unknown items"}</span><b>{preview.unknownDataIds.length}</b></div></div>
        <UpgradeAvailabilityPanel builders={preview.builders} upgradeSlots={preview.upgradeSlots} />
        {preview.isNew && <label className="new-label">{ko ? "표시 이름" : "Display name"}<input required autoFocus value={newLabel} onChange={(event) => setNewLabel(event.target.value)} placeholder={ko ? "예: 메인 마을" : "e.g. Main village"} /><small>{ko ? "처음 보는 태그입니다. 확인할 때 새 마을로 등록됩니다." : "This tag is new. It will be registered when you confirm."}</small></label>}
        <div className="preview-upgrades">{preview.upgrades.slice(0, 8).map((item) => <div key={item.id}><span><b>{item.name}</b><small>Lv. {item.level} → {item.nextLevel}</small></span><time>{formatDateTime(item.finishAt)}</time></div>)}{preview.upgrades.length > 8 && <p>+ {preview.upgrades.length - 8}</p>}</div>
        <div className="confirm-row"><button className="secondary" onClick={() => setPreview(null)}>{ko ? "다시 붙여넣기" : "Paste again"}</button><button disabled={preview.isNew && !newLabel.trim()} onClick={async () => {
          const result = await run(() => request("/api/admin/village-export", { method: "POST", body: JSON.stringify({ exportText, label: newLabel }) }), preview.isNew ? (ko ? "새 마을을 추가하고 데이터를 반영했습니다." : "Village added and data imported.") : (ko ? "마을 데이터를 반영했습니다." : "Village data imported."));
          if (result) { setExportText(""); setPreview(null); setNewLabel(""); }
        }}>{preview.isNew ? (ko ? "마을 추가하고 반영" : "Add village and import") : (ko ? "이 마을에 반영" : "Import to this village")}</button></div>
      </article>}
    </div>}

    {section === "manual" && <article className="admin-card wide-card"><h2>{ko ? "수동 업그레이드 보정" : "Manual upgrade adjustment"}</h2><p>{ko ? "새 JSON을 복사하기 어려울 때만 사용합니다." : "Use this only when copying a fresh export is inconvenient."}</p>
      <form className="admin-form upgrade-form" onSubmit={(event: FormEvent) => { event.preventDefault(); run(async () => { const result = await request("/api/admin/upgrades", { method: "POST", body: JSON.stringify({ accountId: upgrade.accountId, name: upgrade.name, type: upgrade.type, level: Number(upgrade.level), nextLevel: Number(upgrade.nextLevel), remainingMinutes: Number(upgrade.remainingHours) * 60 }) }); setUpgrade({ ...blankUpgrade, accountId: upgrade.accountId }); return result; }, ko ? "업그레이드를 추가했습니다." : "Upgrade added."); }}>
        <label>{ko ? "마을" : "Village"}<select required value={upgrade.accountId} onChange={(e) => setUpgrade({ ...upgrade, accountId: e.target.value })}><option value="">-</option>{accounts.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <label>{ko ? "업그레이드" : "Upgrade"}<input required value={upgrade.name} onChange={(e) => setUpgrade({ ...upgrade, name: e.target.value })} /></label>
        <label>{ko ? "종류" : "Type"}<select value={upgrade.type} onChange={(e) => setUpgrade({ ...upgrade, type: e.target.value })}><option value="building">Building</option><option value="hero">Hero</option><option value="pet">Pet</option><option value="research">Research</option></select></label>
        <label>{ko ? "현재 레벨" : "Current level"}<input type="number" min="0" value={upgrade.level} onChange={(e) => setUpgrade({ ...upgrade, level: e.target.value })} /></label>
        <label>{ko ? "다음 레벨" : "Next level"}<input type="number" min="1" value={upgrade.nextLevel} onChange={(e) => setUpgrade({ ...upgrade, nextLevel: e.target.value })} /></label>
        <label>{ko ? "남은 시간" : "Hours remaining"}<input type="number" min="0.1" step="0.1" value={upgrade.remainingHours} onChange={(e) => setUpgrade({ ...upgrade, remainingHours: e.target.value })} /></label><button>{ko ? "추가" : "Add"}</button>
      </form>
      <div className="upgrade-admin-list">{upgrades.filter((item) => item.status === "active").map((item) => <div key={item.id}><span><b>{accounts.find((a) => a.id === item.accountId)?.label} · {item.name}</b><small>{formatDateTime(item.finishAt)}</small></span><button onClick={() => run(() => request(`/api/admin/upgrades/${item.id}`, { method: "PATCH", body: JSON.stringify({ remainingMinutes: 60 }) }), ko ? "남은 시간을 1시간으로 변경했습니다." : "Set to one hour remaining.")}>{ko ? "1시간 남음" : "1h left"}</button><button onClick={() => run(() => request(`/api/admin/upgrades/${item.id}`, { method: "PATCH", body: JSON.stringify({ status: "completed" }) }), ko ? "완료 처리했습니다." : "Marked complete.")}>{ko ? "완료" : "Complete"}</button><button className="danger" onClick={() => run(() => request(`/api/admin/upgrades/${item.id}`, { method: "PATCH", body: JSON.stringify({ status: "cancelled" }) }), ko ? "취소했습니다." : "Cancelled.")}>{ko ? "취소" : "Cancel"}</button></div>)}</div>
    </article>}

    {section === "villages" && <div className="village-admin-layout"><article className="admin-card"><h2>{ko ? "등록된 마을" : "Registered villages"}</h2><p>{ko ? "이름을 정리하거나 연동 설정을 변경할 마을을 선택하세요." : "Choose a village to rename it or change integrations."}</p><div className="admin-list village-picker">{accounts.map((item) => <button key={item.id} className={editing?.id === item.id ? "selected" : ""} onClick={() => chooseAccount(item)}><i style={{ background: item.color }} /><span><b>{item.label}</b><small>{item.playerTag}</small></span></button>)}{!accounts.length && <p>{ko ? "등록된 마을이 없습니다. JSON을 붙여넣어 추가하세요." : "No villages yet. Add one by importing JSON."}</p>}</div></article>
      <article className="admin-card">{editing ? <><h2>{ko ? "마을 설정" : "Village settings"}</h2><p>{editing.playerTag}</p><form className="admin-form" onSubmit={(event) => { event.preventDefault(); run(async () => { await request(`/api/admin/accounts/${editing.id}`, { method: "PATCH", body: JSON.stringify(accountForm) }); setEditing(null); }, ko ? "마을 설정을 저장했습니다." : "Village settings saved."); }}>
        <label>{ko ? "표시 이름" : "Display name"}<input required value={accountForm.label} onChange={(e) => setAccountForm({ ...accountForm, label: e.target.value })} /></label><label>{ko ? "색상" : "Color"}<input type="color" value={accountForm.color} onChange={(e) => setAccountForm({ ...accountForm, color: e.target.value })} /></label>
        <label className="wide">{ko ? "상태 서버 URL (선택)" : "Source URL (optional)"}<input value={accountForm.sourceUrl} onChange={(e) => setAccountForm({ ...accountForm, sourceUrl: e.target.value })} /></label>
        <label className="wide">{ko ? "새 수집 API 키 (비우면 유지)" : "New ingest API key (leave blank to keep)"}<input type="password" value={accountForm.apiKey} onChange={(e) => setAccountForm({ ...accountForm, apiKey: e.target.value })} /></label>
        <button className="wide">{ko ? "설정 저장" : "Save settings"}</button></form><button className="danger standalone-danger" onClick={() => confirm(ko ? "마을과 관련 데이터를 삭제할까요?" : "Delete this village and its related data?") && run(async () => { await request(`/api/admin/accounts/${editing.id}`, { method: "DELETE" }); setEditing(null); }, ko ? "삭제했습니다." : "Deleted.")}>{ko ? "마을 삭제" : "Delete village"}</button></> : <div className="empty settings-empty">{ko ? "왼쪽에서 마을을 선택하세요." : "Choose a village on the left."}</div>}</article></div>}
  </section>;
}
