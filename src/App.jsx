import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardHeader, CardContent, CardFooter, Button, Input, Label, Textarea, Badge, Tabs, TabsList, TabsTrigger, TabsContent, Alert, AlertTitle, AlertDescription } from "./ui.jsx";
import { Download, KeyRound, Upload, Shield, Share2, Lock, Unlock, Plus, Trash2, Sparkles } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import secrets from "secrets.js-grempe";

const ShieldCheck = Shield;
const DEMO = true;

async function sha256Hex(buffer) {
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, "0")).join("");
}

function ab2b64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  return btoa(binary);
}

function b642ab(strB64) {
  const bin = atob(strB64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

function bufToHex(buf) {
  const u8 = buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf;
  return [...u8].map(b => b.toString(16).padStart(2, "0")).join("");
}

function hexToBuf(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes.buffer;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function downloadJSON(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  downloadBlob(blob, filename);
}

function useVault() {
  const [cipherB64, setCipherB64] = useState("");
  const [ivHex, setIvHex] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState(0);
  const [plainHash, setPlainHash] = useState("");
  const [shares, setShares] = useState([]);
  const [threshold, setThreshold] = useState(2);
  const [total, setTotal] = useState(3);

  useEffect(() => {
    const s = localStorage.getItem("vault_state");
    if (s) {
      try {
        const v = JSON.parse(s);
        setCipherB64(v.cipherB64 || "");
        setIvHex(v.ivHex || "");
        setFileName(v.fileName || "");
        setFileSize(v.fileSize || 0);
        setPlainHash(v.plainHash || "");
        setShares(v.shares || []);
        setThreshold(v.threshold || 2);
        setTotal(v.total || 3);
      } catch {}
    } else if (DEMO) {
      const demoKeyHex = "a".repeat(64);
      const demoShares = secrets.share(demoKeyHex, 3, 2).map((s, i) => ({ id: crypto.randomUUID(), label: ["Pritesh","Omkar","Gaurang"][i] || `Member ${i+1}`, share: s }));
      setCipherB64(btoa("democipher"));
      setIvHex("00112233445566778899aabb");
      setFileName("confidential.pdf");
      setFileSize(24576);
      setPlainHash("d3c94468f0d84b34a3e9e1b7e2f9b5b0d3c94468f0d84b34a3e9e1b7e2f9b5b0");
      setShares(demoShares);
      setThreshold(2);
      setTotal(3);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      "vault_state",
      JSON.stringify({ cipherB64, ivHex, fileName, fileSize, plainHash, shares, threshold, total })
    );
  }, [cipherB64, ivHex, fileName, fileSize, plainHash, shares, threshold, total]);

  const clear = () => {
    setCipherB64("");
    setIvHex("");
    setFileName("");
    setFileSize(0);
    setPlainHash("");
    setShares([]);
    setThreshold(2);
    setTotal(3);
  };

  return { cipherB64, setCipherB64, ivHex, setIvHex, fileName, setFileName, fileSize, setFileSize, plainHash, setPlainHash, shares, setShares, threshold, setThreshold, total, setTotal, clear };
}

async function encryptFileWithShamir(file, total, threshold) {
  const arrayBuffer = await file.arrayBuffer();
  const hashHex = await sha256Hex(arrayBuffer);
  const key = new Uint8Array(32);
  crypto.getRandomValues(key);
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "AES-GCM" }, false, ["encrypt"]);
  const cipherBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, cryptoKey, arrayBuffer);
  const keyHex = [...key].map(b => b.toString(16).padStart(2, "0")).join("");
  const shares = secrets.share(keyHex, total, threshold);
  return {
    cipherB64: ab2b64(cipherBuf),
    ivHex: bufToHex(iv),
    shares,
    fileMeta: { name: file.name, size: file.size, type: file.type || "application/octet-stream" },
    hashHex,
  };
}

async function decryptFileFromShares({ cipherB64, ivHex, shares }) {
  const keyHex = secrets.combine(shares);
  const keyBuf = hexToBuf(keyHex);
  const cryptoKey = await crypto.subtle.importKey("raw", keyBuf, { name: "AES-GCM" }, false, ["decrypt"]);
  const iv = new Uint8Array(hexToBuf(ivHex));
  const cipherBuf = b642ab(cipherB64);
  const plainBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, cryptoKey, cipherBuf);
  return plainBuf;
}

function Shell({ children }) {
  return (
    <div>
      <header className="header">
        <div className="container" style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 16px'}}>
          <Link to="/" className="row" style={{gap:8}}>
            <ShieldCheck size={22} />
            <strong>VeriVault</strong>
          </Link>
          <nav className="nav">
            <Link to="/encrypt">Encrypt</Link>
            <Link to="/distribute">Distribute</Link>
            <Link to="/recover">Recover</Link>
            {DEMO && <span className="badge"><Sparkles size={14} style={{marginRight:6}}/>Demo</span>}
          </nav>
        </div>
      </header>
      <main className="container" style={{paddingTop:24}}>{children}</main>
      <div className="container footer-note">Demo-only frontend. No server. All crypto runs in-browser using Web Crypto API and Shamir via secrets.js-grempe.</div>
    </div>
  );
}

function Home() {
  const navigate = useNavigate();
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card>
        <CardHeader>
          <div className="row">
            <ShieldCheck size={24} />
            <h1>Threshold-Encrypted Document Sharing</h1>
          </div>
        </CardHeader>
        <CardContent>
          <p style={{opacity:.85, marginBottom:12}}>Upload a confidential document, encrypt client-side with AES‑GCM, split the key with Shamir's Secret Sharing, hand out shares to teammates, and later recover the key with any t-of-n subset.</p>
          <div className="grid grid-3">
            <Step icon={<Upload size={18}/>} title="Encrypt" text="AES‑GCM 256 on-device. No key leaves the browser." />
            <Step icon={<Share2 size={18}/>} title="Distribute" text="Generate n shares; set any threshold t to reconstruct." />
            <Step icon={<KeyRound size={18}/>} title="Recover" text="Combine t shares, decrypt, and download the original." />
          </div>
        </CardContent>
        <CardFooter>
          <Button><Link to="/encrypt">Start Encrypting</Link></Button>
          <Button variant="secondary"><Link to="/recover">Recover a File</Link></Button>
          {DEMO && <Button variant="outline" onClick={() => navigate("/distribute")}>Open Demo Shares</Button>}
        </CardFooter>
      </Card>
    </motion.div>
  );
}

function Step({ icon, title, text }) {
  return (
    <div className="card">
      <div className="row" style={{marginBottom:8}}>
        <div className="badge">{icon}</div>
        <div style={{fontWeight:600}}>{title}</div>
      </div>
      <div style={{opacity:.85,fontSize:14}}>{text}</div>
    </div>
  );
}

function EncryptPage() {
  const v = useVault();
  const [busy, setBusy] = useState(false);
  const [members, setMembers] = useState([
    { id: crypto.randomUUID(), label: "Pritesh" },
    { id: crypto.randomUUID(), label: "Omkar" },
    { id: crypto.randomUUID(), label: "Gaurang" },
  ]);

  const onUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const { cipherB64, ivHex, shares, fileMeta, hashHex } = await encryptFileWithShamir(file, v.total, v.threshold);
      v.setCipherB64(cipherB64);
      v.setIvHex(ivHex);
      v.setFileName(fileMeta.name);
      v.setFileSize(fileMeta.size);
      v.setPlainHash(hashHex);
      const assigned = shares.map((s, idx) => ({ id: members[idx]?.id || crypto.randomUUID(), label: members[idx]?.label || `Member ${idx + 1}`, share: s }));
      v.setShares(assigned);
    } catch (err) {
      alert("Encryption failed: " + (err?.message || err));
    } finally {
      setBusy(false);
    }
  };

  const addMember = () => setMembers(m => [...m, { id: crypto.randomUUID(), label: "" }]);
  const removeMember = (id) => setMembers(m => m.filter(x => x.id !== id));

  const recomputeShares = () => {
    if (!v.cipherB64) return alert("Upload a file first.");
    alert("To change n or t, re-upload the file and re-encrypt. (Demo keeps no raw key after encryption.)");
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card>
        <CardHeader>
          <div className="row"><Lock size={20} /><h2>Encrypt & Split</h2></div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-3">
            <div style={{gridColumn:'span 2'}}>
              <Label>Choose file</Label>
              <div className="row">
                <Input type="file" onChange={onUpload} disabled={busy} />
                <Button disabled={busy}><Upload size={16}/>Upload</Button>
              </div>
              {(v.fileName || DEMO) && (
                <div style={{marginTop:10,fontSize:13,opacity:.85}}>
                  <div><strong>File:</strong> {v.fileName || "confidential.pdf"} <span className="badge">{((v.fileSize || 24576) / 1024).toFixed(1)} KB</span></div>
                  <div className="mono" style={{wordBreak:'break-all'}}><strong>SHA-256:</strong> {v.plainHash || "d3c94468f0d84b34a3e9e1b7e2f9b5b0d3c94468f0d84b34a3e9e1b7e2f9b5b0"}</div>
                  <div className="mono" style={{wordBreak:'break-all'}}><strong>IV:</strong> {v.ivHex || "00112233445566778899aabb"}</div>
                </div>
              )}
            </div>
            <div>
              <div className="grid grid-2">
                <div>
                  <Label>Total members (n)</Label>
                  <Input type="number" min={2} value={v.total} onChange={e => v.setTotal(parseInt(e.target.value || "0"))} />
                </div>
                <div>
                  <Label>Threshold (t)</Label>
                  <Input type="number" min={2} value={v.threshold} onChange={e => v.setThreshold(parseInt(e.target.value || "0"))} />
                </div>
              </div>
              <Button className="btn outline" onClick={recomputeShares}>Update (re-encrypt required)</Button>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          {(v.cipherB64 || DEMO) && <Button onClick={() => downloadBlob(new Blob([b642ab(v.cipherB64 || btoa("democipher"))], { type: "application/octet-stream" }), `${(v.fileName || "confidential.pdf")}.enc`)}><Download size={16}/>Download Encrypted</Button>}
          <Button variant="secondary"><Link to="/distribute">Go to Distribute</Link></Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <div className="row"><Share2 size={18} /><h3>Members</h3></div>
        </CardHeader>
        <CardContent>
          <div className="grid" style={{gap:10}}>
            {(v.shares?.length ? v.shares : Array.from({ length: 3 }, (_, i) => ({ id: String(i), label: ["Pritesh","Omkar","Gaurang"][i] || `Member ${i+1}` }))).map((m, idx) => (
              <div key={m.id} className="row" style={{gap:8}}>
                <Input placeholder="Name or identifier" value={m.label} onChange={e => v.setShares(list => (list?.length ? list.map(x => x.id === m.id ? { ...x, label: e.target.value } : x) : []))} />
                <Button onClick={() => {}} className="btn" style={{padding:'8px 10px'}}><Trash2 size={16} /></Button>
              </div>
            ))}
            <Button onClick={() => {}} className="btn outline"><Plus size={16} />Add member</Button>
          </div>
          <Alert>
            <AlertTitle>Heads up</AlertTitle>
            <AlertDescription>Members listed here are for labeling shares only in this demo. No invitations are sent.</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function DistributePage() {
  const v = useVault();
  const [qrSize, setQrSize] = useState(128);
  const [note, setNote] = useState("Authorized use only. Keep your share offline.");

  const exportAll = () => {
    if (!(v.shares?.length) && DEMO) {
      const demoKeyHex = "a".repeat(64);
      const demoShares = secrets.share(demoKeyHex, 3, 2).map((s, i) => ({ label: ["Pritesh","Omkar","Gaurang"][i] || `Member ${i+1}`, share: s }));
      return downloadJSON(demoShares.map((s) => ({ ...s, meta: { file: "confidential.pdf", iv: "00112233445566778899aabb", threshold: 2, total: 3 } })), "confidential.pdf.shares.json");
    }
    if (!v.shares?.length) return alert("No shares yet.");
    const bundle = v.shares.map((s, idx) => ({
      label: s.label || `Member ${idx + 1}`,
      share: s.share,
      meta: { file: v.fileName, iv: v.ivHex, threshold: v.threshold, total: v.total }
    }));
    downloadJSON(bundle, `${v.fileName || "file"}.shares.json`);
  };

  const sharesToShow = v.shares?.length ? v.shares : secrets.share("a".repeat(64), 3, 2).map((s, i) => ({ label: ["Pritesh","Omkar","Gaurang"][i] || `Member ${i+1}`, share: s }));

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card>
        <CardHeader>
          <div className="row"><Share2 size={18} /><h2>Distribute Shares</h2></div>
        </CardHeader>
        <CardContent>
          <div className="kv">
            <span className="chip">File: {v.fileName || "confidential.pdf"}</span>
            <span className="chip">t = {v.threshold || 2} of n = {v.total || 3}</span>
            <span className="chip">IV: {(v.ivHex || "00112233445566778899aabb").slice(0, 16)}…</span>
          </div>

          <div className="grid grid-3" style={{marginTop:12}}>
            {sharesToShow.map((s, idx) => (
              <Card key={idx}>
                <CardHeader>
                  <div className="row"><KeyRound size={16} /><div style={{fontWeight:600}}>{s.label || `Member ${idx + 1}`}</div></div>
                </CardHeader>
                <CardContent>
                  <div className="mono" style={{padding:10, background:'rgba(0,0,0,.25)', borderRadius:12, wordBreak:'break-all', fontSize:12}}>{s.share}</div>
                  <div className="qr" style={{marginTop:8}}>
                    <QRCodeCanvas value={s.share} size={qrSize} includeMargin />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button className="secondary" onClick={() => navigator.clipboard.writeText(s.share)}>Copy</Button>
                  <Button onClick={() => downloadJSON({ label: s.label, share: s.share, meta: { file: v.fileName || "confidential.pdf", iv: v.ivHex || "00112233445566778899aabb", t: v.threshold || 2, n: v.total || 3 }, note }, `${(s.label || `member-${idx + 1}`).toLowerCase()}-${(v.fileName || "confidential.pdf")}.share.json`)}>
                    <Download size={16}/>Download
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>

          <div className="grid grid-3" style={{marginTop:12}}>
            <div>
              <Label>QR size</Label>
              <Input type="number" min={96} max={256} value={qrSize} onChange={e => setQrSize(parseInt(e.target.value || "128"))} />
            </div>
            <div style={{gridColumn:'span 2'}}>
              <Label>Embed note with each exported share</Label>
              <Textarea value={note} onChange={e => setNote(e.target.value)} />
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button variant="secondary"><Link to="/encrypt">Back to Encrypt</Link></Button>
          <Button onClick={exportAll}><Download size={16}/>Export All</Button>
        </CardFooter>
      </Card>
    </motion.div>
  );
}

function RecoverPage() {
  const v = useVault();
  const [busy, setBusy] = useState(false);
  const [pickedEnc, setPickedEnc] = useState(null);
  const [shares, setShares] = useState(["", "", ""]);
  const [iv, setIv] = useState("");
  const [name, setName] = useState("recovered.bin");

  useEffect(() => {
    if (DEMO && (!shares[0] || !shares[1])) {
      const demo = secrets.share("a".repeat(64), 3, 2);
      setShares([demo[0], demo[1], ""]);
    }
  }, []);

  const loadEncrypted = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const buf = await file.arrayBuffer();
    const b64 = ab2b64(buf);
    setPickedEnc({ name: file.name, size: file.size, b64 });
  };

  const tryDecrypt = async () => {
    const used = shares.filter(Boolean);
    if (used.length < (v.threshold || 2)) return alert("Provide enough shares to reach the threshold.");
    setBusy(true);
    try {
      if (DEMO) {
        const blob = new Blob(["Demo recovered content"], { type: "application/octet-stream" });
        downloadBlob(blob, name || "recovered.bin");
      } else {
        const plainBuf = await decryptFileFromShares({ cipherB64: pickedEnc?.b64 || v.cipherB64, ivHex: iv || v.ivHex, shares: used });
        const blob = new Blob([plainBuf]);
        downloadBlob(blob, name || "recovered.bin");
      }
    } catch (err) {
      alert("Decryption failed: " + (err?.message || err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card>
        <CardHeader>
          <div className="row"><Unlock size={18} /><h2>Recover & Decrypt</h2></div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="from-state">
            <TabsList>
              <TabsTrigger value="from-state" onClick={() => {}}>Use current session</TabsTrigger>
              <TabsTrigger value="from-file" onClick={() => {}}>Use .enc file</TabsTrigger>
            </TabsList>
            <TabsContent value="from-state">
              <Alert>
                <AlertTitle>Using encrypted data in memory</AlertTitle>
                <AlertDescription>IV: {v.ivHex || "00112233445566778899aabb"}</AlertDescription>
              </Alert>
            </TabsContent>
            <TabsContent value="from-file">
              <Label>Pick encrypted file (.enc)</Label>
              <Input type="file" onChange={loadEncrypted} />
              {pickedEnc && <div style={{opacity:.85,fontSize:14}}>Loaded {pickedEnc.name} • {(pickedEnc.size / 1024).toFixed(1)} KB</div>}
            </TabsContent>
          </Tabs>

          <div className="grid grid-2">
            <div>
              <Label>IV (hex)</Label>
              <Input placeholder="iv hex" value={iv} onChange={e => setIv(e.target.value)} />
              <div style={{fontSize:12,opacity:.7}}>Leave blank to use IV from current session.</div>
            </div>
            <div>
              <Label>Output filename</Label>
              <Input placeholder="recovered.bin" value={name} onChange={e => setName(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-3">
            {shares.map((s, i) => (
              <div key={i}>
                <Label>Share #{i + 1}</Label>
                <Input placeholder="shamir share string" value={s} onChange={e => setShares(list => list.map((x, idx) => idx === i ? e.target.value : x))} />
              </div>
            ))}
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={tryDecrypt} disabled={busy}><KeyRound size={16}/>Combine & Decrypt</Button>
          <Button variant="secondary"><Link to="/distribute">Need shares?</Link></Button>
        </CardFooter>
      </Card>
    </motion.div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Shell>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/encrypt" element={<EncryptPage />} />
          <Route path="/distribute" element={<DistributePage />} />
          <Route path="/recover" element={<RecoverPage />} />
        </Routes>
      </Shell>
    </BrowserRouter>
  );
}
