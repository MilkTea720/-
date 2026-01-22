/**
 * 善商薪資大師 2026 - 核心邏輯大腦 (salary.js)
 */

// --- 1. 2026 勞健保分級表數據 (根據圖片轉換) ---
const labTbl = [
    {limit: 11100, lab: 277}, {limit: 12540, lab: 313}, {limit: 13500, lab: 338}, 
    {limit: 15840, lab: 396}, {limit: 28590, lab: 715}, {limit: 45800, lab: 1145}
];
const heaTbl = [
    {limit: 42000, hea: 458}, {limit: 45800, hea: 710}, {limit: 48200, hea: 748}, 
    {limit: 50600, hea: 785}, {limit: 150000, hea: 2327}
];

function getInsurance(gross) {
    let lab = 1145, hea = 785;
    for (let row of labTbl) { if (gross <= row.limit) { lab = row.lab; break; } }
    for (let row of heaTbl) { if (gross <= row.limit) { hea = row.hea; break; } }
    return { lab, hea };
}

// --- 2. 初始化與表格生成 ---
function getTimeOptions(isMin, selectedVal) {
    let options = '<option value="">--</option>';
    const vals = isMin ? ['00', '15', '30', '45'] : Array.from({length: 24}, (_, i) => i.toString().padStart(2, '0'));
    vals.forEach(v => options += `<option value="${v}" ${v === selectedVal ? 'selected' : ''}>${v}</option>`);
    return options;
}

function initTable() {
    const mode = document.getElementById('mode').value;
    const body = document.getElementById('inputRows');
    const saved = JSON.parse(localStorage.getItem('salary_data_final') || '{}');
    document.getElementById('selMonth').style.display = mode === 'month' ? 'inline-block' : 'none';
    body.innerHTML = '';
    let num = mode === 'week' ? 7 : new Date(2026, document.getElementById('selMonth').value.split('-')[1], 0).getDate();
    
    for (let i = 0; i < num; i++) {
        const d = (saved.rows && saved.rows[i]) ? saved.rows[i] : {};
        body.innerHTML += `<tr>
            <td>${mode==='week'?['一','二','三','四','五','六','日'][i]:(i+1)}</td>
            <td><select id="sh_${i}" onchange="saveData()">${getTimeOptions(false, d.sh)}</select>:<select id="sm_${i}" onchange="saveData()">${getTimeOptions(true, d.sm)}</select></td>
            <td><select id="eh_${i}" onchange="saveData()">${getTimeOptions(false, d.eh)}</select>:<select id="em_${i}" onchange="saveData()">${getTimeOptions(true, d.em)}</select></td>
            <td><input type="number" id="br_${i}" value="${d.br||0}" step="0.25" class="input-narrow" onchange="saveData()"></td>
            <td><input type="number" id="mo_${i}" value="${d.mo||0}" step="0.25" class="input-narrow" onchange="saveData()"></td>
            <td><input type="checkbox" id="db_${i}" ${d.db?'checked':''} onchange="saveData()"></td>
            <td id="st_${i}" class="status-tag"></td>
        </tr>`;
    }
}

// --- 3. 資料持久化 (自動存檔) ---
function saveData() {
    const rows = [];
    const count = document.getElementById('inputRows').rows.length;
    for(let i=0; i<count; i++){
        rows.push({
            sh: document.getElementById(`sh_${i}`).value, sm: document.getElementById(`sm_${i}`).value,
            eh: document.getElementById(`eh_${i}`).value, em: document.getElementById(`em_${i}`).value,
            br: document.getElementById(`br_${i}`).value, mo: document.getElementById(`mo_${i}`).value,
            db: document.getElementById(`db_${i}`).checked
        });
    }
    localStorage.setItem('salary_data_final', JSON.stringify({
        rate: document.getElementById('baseRate').value,
        att: document.getElementById('hasAtt').checked,
        mode: document.getElementById('mode').value,
        month: document.getElementById('selMonth').value,
        rows: rows
    }));
}

function switchMode() { saveData(); initTable(); }

// --- 4. 核心計算邏輯 (先加後乘 + 第6天 2.67x) ---
function calculateSalary() {
    saveData();
    const A = parseFloat(document.getElementById('baseRate').value);
    const B = document.getElementById('hasAtt').checked ? A + 10 : A;
    const count = document.getElementById('inputRows').rows.length;
    let data = [];

    // 判定第六天
    for (let i = 0; i < count; i++) {
        const sh = document.getElementById(`sh_${i}`).value, eh = document.getElementById(`eh_${i}`).value;
        const br = parseFloat(document.getElementById(`br_${i}`).value) || 0;
        const mo = parseFloat(document.getElementById(`mo_${i}`).value) || 0;
        let h = 0, s = 0, e = 0;
        if (sh && eh) {
            s = parseInt(sh) + parseInt(document.getElementById(`sm_${i}`).value)/60;
            e = parseInt(eh) + parseInt(document.getElementById(`em_${i}`).value)/60;
            if (e <= s) e += 24;
            h = (e - s - br) + mo;
        }
        data.push({ id: i, s, e, h, db: document.getElementById(`db_${i}`).checked, isDay6: false });
        document.getElementById(`st_${i}`).innerText = "";
    }

    for (let w = 0; w < data.length; w += 7) {
        let week = data.slice(w, w + 7).filter(d => d.h > 0 && !d.db);
        if (week.length >= 6) {
            week.sort((a, b) => a.h - b.h);
            data[week[0].id].isDay6 = true;
            document.getElementById(`st_${week[0].id}`).innerText = "第6天";
        }
    }

    let totalGross = 0, baseM = 0, otM = 0, nightM = 0, h_norm = 0, h_ot1 = 0, h_ot2 = 0, h_ot3 = 0, h_night = 0;

    data.forEach(day => {
        if (day.h <= 0) return;
        for (let t = day.s; t < day.e; t += 0.25) {
            let hour = t % 24, isNight = (hour >= 23 || hour < 6);
            let rate = isNight ? B + 50 : B;
            if (isNight) { h_night += 0.25; nightM += (0.25 * 50); }

            let progress = t - day.s, mult = 1.0;
            if (day.db) mult = 2.0;
            else if (day.isDay6) {
                if (progress >= 8) { mult = 2.67; h_ot3 += 0.25; }
                else if (progress >= 2) { mult = 1.67; h_ot2 += 0.25; }
                else { mult = 1.34; h_ot1 += 0.25; }
            } else {
                if (progress >= 10) { mult = 1.67; h_ot2 += 0.25; }
                else if (progress >= 8) { mult = 1.34; h_ot1 += 0.25; }
                else { h_norm += 0.25; }
            }

            let pay = 0.25 * rate * mult;
            if (mult === 1.0 || day.db) baseM += pay; else otM += pay;
            totalGross += pay;
        }
    });

    // 5. 勞健保計算與渲染結果
    const ins = getInsurance(totalGross);
    const gen2 = totalGross >= 28590 ? Math.round(totalGross * 0.0191) : 0;
    const welfare = Math.round(totalGross * 0.005);
    const finalPay = totalGross - ins.lab - ins.hea - gen2 - welfare;

    document.getElementById('reportCard').style.display = 'block';
    document.getElementById('res_B').innerText = B;
    document.getElementById('res_h_norm').innerText = h_norm.toFixed(2);
    document.getElementById('res_h_ot1').innerText = h_ot1.toFixed(2);
    document.getElementById('res_h_ot2').innerText = h_ot2.toFixed(2);
    document.getElementById('res_h_ot3').innerText = h_ot3.toFixed(2);
    document.getElementById('res_h_night').innerText = h_night.toFixed(2);
    document.getElementById('res_m_base').innerText = Math.round(baseM).toLocaleString();
    document.getElementById('res_m_ot').innerText = Math.round(otM).toLocaleString();
    document.getElementById('res_m_night').innerText = Math.round(nightM).toLocaleString();
    document.getElementById('res_m_gross').innerText = Math.round(totalGross).toLocaleString();
    document.getElementById('res_m_lab').innerText = ins.lab;
    document.getElementById('res_m_hea').innerText = ins.hea;
    document.getElementById('res_m_gen2').innerText = gen2;
    document.getElementById('res_m_wel').innerText = welfare;
    document.getElementById('res_m_minus').innerText = (ins.lab + ins.hea + gen2 + welfare).toLocaleString();
    document.getElementById('r_final').innerText = Math.round(finalPay).toLocaleString();
}

// 📸 匯出圖片功能
function exportAsImage() {
    const element = document.getElementById('reportCard');
    const btn = document.querySelector('.btn-export');
    btn.style.display = 'none';
    html2canvas(element, { scale: 2 }).then(canvas => {
        const link = document.createElement('a');
        link.download = `薪資單_${new Date().toLocaleDateString()}.png`;
        link.href = canvas.toDataURL();
        link.click();
        btn.style.display = 'block';
    });
}

// 初始化
window.onload = () => {
    const saved = JSON.parse(localStorage.getItem('salary_data_final') || '{}');
    if (saved.rate) {
        document.getElementById('baseRate').value = saved.rate;
        document.getElementById('hasAtt').checked = saved.att;
        document.getElementById('mode').value = saved.mode;
        document.getElementById('selMonth').value = saved.month;
    }
    initTable();
};