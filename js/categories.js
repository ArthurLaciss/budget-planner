/* Budget Planner: ready-made categories and the icon set used for them.
 * Icons are simple SVG paths drawn in the Feather / Lucide style (stroke icons).
 * Categories added by the user are stored separately (see storage.js) and merged in app.js.
 */
(function (root) {
  'use strict';

  const ICONS = {
    utensils:'<path d="M3 2v7c0 1.1.9 2 2 2h1v11"/><path d="M6 2v20"/><path d="M9 2v7c0 1.1-.9 2-2 2"/><path d="M18 2c-1.5 2-2 4-2 7 0 2 1 3 2 3s2-1 2-3c0-3-.5-5-2-7Z"/><path d="M18 12v10"/>',
    cart:'<circle cx="9" cy="20" r="1.3"/><circle cx="18" cy="20" r="1.3"/><path d="M2 3h2l2.6 12.4a2 2 0 0 0 2 1.6h8.8a2 2 0 0 0 2-1.6L21 7H6"/>',
    car:'<path d="M5 17h14M5 17a2 2 0 1 1-4 0m4 0a2 2 0 1 0 4 0m10 0a2 2 0 1 1-4 0m4 0a2 2 0 1 0 4 0M3 17V9l2-5h14l2 5v8"/>',
    heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z"/>',
    cap:'<path d="M22 10 12 5 2 10l10 5 10-5Z"/><path d="M6 12v5c0 1.5 3 3 6 3s6-1.5 6-3v-5"/>',
    shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>',
    card:'<rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>',
    percent:'<line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
    tv:'<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M8 2l4 5 4-5"/>',
    bolt:'<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    bag:'<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M9 10a3 3 0 0 0 6 0"/>',
    piechart:'<path d="M21.2 15.2A10 10 0 1 1 12 2v10z"/>',
    plane:'<path d="M2 12l20-7-7 20-3-8-8-3Z"/>',
    repeat:'<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
    sparkle:'<path d="M12 2l1.8 5.4L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.6Z"/>',
    swap:'<polyline points="17 3 21 7 17 11"/><path d="M3 7h18"/><polyline points="7 21 3 17 7 13"/><path d="M21 17H3"/>',
    receipt:'<path d="M4 2h16v20l-3-2-3 2-3-2-3 2-3-2-1 1V2Z"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="16" y2="11"/>',
    home:'<path d="M3 11l9-8 9 8"/><path d="M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10"/>',
    banknote:'<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><line x1="6" y1="10" x2="6" y2="10.01"/><line x1="18" y1="14" x2="18" y2="14.01"/>',
    baby:'<circle cx="12" cy="7" r="4"/><path d="M9 14c0 3 1.5 5 3 5s3-2 3-5"/><path d="M5 18c1-2 3-3 7-3s6 1 7 3"/>',
    ellipsis:'<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
    tag:'<path d="M20.6 12.6 12.6 20.6a2 2 0 0 1-2.8 0l-8-8A2 2 0 0 1 2 11.2V4a2 2 0 0 1 2-2h7.2a2 2 0 0 1 1.4.6l8 8a2 2 0 0 1 0 2.8Z"/><line x1="7" y1="7" x2="7.01" y2="7"/>',
    briefcase:'<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
    gift:'<rect x="3" y="8" width="18" height="13" rx="1"/><path d="M12 8v13"/><path d="M3 12h18"/><path d="M12 8C10 5 5.5 4 5.5 7 5.5 9 8 8 12 8ZM12 8c2-3 6.5-4 6.5-1 0 2-2.5 1-6.5 1Z"/>',
    search:'<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    calendar:'<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    plus:'<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    close:'<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    edit:'<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    trash:'<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>',
    check:'<polyline points="20 6 9 17 4 12"/>',
    cookie:'<path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5Z"/><circle cx="8.5" cy="11" r=".8"/><circle cx="12" cy="16" r=".8"/><circle cx="16" cy="13" r=".8"/><circle cx="8" cy="15.5" r=".8"/>',
    bus:'<rect x="4" y="3" width="16" height="14" rx="2"/><path d="M4 11h16"/><path d="M7 17v3"/><path d="M17 17v3"/><circle cx="8" cy="14" r=".6"/><circle cx="16" cy="14" r=".6"/>',
    train:'<rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 11h14"/><path d="M8 21l2-4"/><path d="M16 21l-2-4"/><circle cx="9" cy="14" r=".6"/><circle cx="15" cy="14" r=".6"/>',
    bike:'<circle cx="5.5" cy="17" r="3.5"/><circle cx="18.5" cy="17" r="3.5"/><path d="M5.5 17 9 8h4l3 9"/><path d="M13 8l1-3h3"/>',
    milk:'<path d="M8 2h8l1 5v13a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V7Z"/><path d="M7 7h10"/><path d="M7 13h10"/>',
    handshake:'<path d="M2 11l5-4 4 2 4-2 5 4"/><path d="M7 13l3 3a1.5 1.5 0 0 0 2-2"/><path d="M12 14l2 2a1.5 1.5 0 0 0 2-2l-2-2"/><path d="M5 12v5l3 2"/><path d="M19 12v5l-3 2"/>',
    alert:'<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
  };
  function iconSvg(name, size, stroke){
    size = size || 18; stroke = stroke || 'currentColor';
    const d = ICONS[name] || ICONS.tag;
    return '<svg width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="'+stroke+'" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">'+d+'</svg>';
  }

  const BASE_CATS = [
    {id:'food', label:'Food & Dining', color:'#E07A3F', icon:'utensils', kind:'expense'},
    {id:'groceries', label:'Groceries', color:'#3FA65C', icon:'cart', kind:'expense'},
    {id:'transport', label:'Transport', color:'#3B82C4', icon:'car', kind:'expense'},
    {id:'health', label:'Healthcare', color:'#D6483F', icon:'heart', kind:'expense'},
    {id:'education', label:'Education', color:'#2AA7B0', icon:'cap', kind:'expense'},
    {id:'insurance', label:'Insurance', color:'#2E9E7A', icon:'shield', kind:'expense'},
    {id:'emi_loans', label:'Loans', color:'#D98A2B', icon:'card', kind:'expense'},
    {id:'loan_interest', label:'Loan Interest', color:'#D96A2B', icon:'percent', kind:'expense'},
    {id:'entertainment', label:'Entertainment', color:'#C6538C', icon:'tv', kind:'expense'},
    {id:'utilities', label:'Utilities', color:'#1D9C8F', icon:'bolt', kind:'expense'},
    {id:'shopping', label:'Shopping', color:'#8B5FBF', icon:'bag', kind:'expense'},
    {id:'investment', label:'Investment', color:'#4C9E4C', icon:'piechart', kind:'both'},
    {id:'travel', label:'Travel & Vacations', color:'#3B8FD6', icon:'plane', kind:'expense'},
    {id:'subscriptions', label:'Subscriptions', color:'#9B6FD1', icon:'repeat', kind:'expense'},
    {id:'personal_care', label:'Personal Care', color:'#D65B7A', icon:'sparkle', kind:'expense'},
    {id:'transfers_remittance', label:'Transfers & Remittance', color:'#6B7280', icon:'swap', kind:'expense'},
    {id:'credit_card_payment', label:'Credit Card Payment', color:'#C0392B', icon:'card', kind:'expense'},
    {id:'taxes', label:'Taxes', color:'#8A6D3B', icon:'receipt', kind:'expense'},
    {id:'rent', label:'Housing & Rent', color:'#7C5FC4', icon:'home', kind:'expense'},
    {id:'cash_withdrawal', label:'Cash Withdrawal', color:'#3F9E5C', icon:'banknote', kind:'expense'},
    {id:'childcare', label:'Childcare', color:'#3FB0A0', icon:'baby', kind:'expense'},
    {id:'snacks', label:'Snacks', color:'#D9822B', icon:'cookie', kind:'expense'},
    {id:'bus', label:'Bus', color:'#E0A33F', icon:'bus', kind:'expense'},
    {id:'metro', label:'Metro', color:'#4A7FD6', icon:'train', kind:'expense'},
    {id:'milk', label:'Milk', color:'#5BA8C9', icon:'milk', kind:'expense'},
    {id:'lend', label:'Lend', color:'#7A8F5C', icon:'handshake', kind:'expense'},
    {id:'other_expense', label:'Other Expense', color:'#8A8375', icon:'ellipsis', kind:'expense'},
    {id:'salary', label:'Salary', color:'#2E9E63', icon:'banknote', kind:'income'},
    {id:'freelance', label:'Freelance', color:'#5CAE5B', icon:'briefcase', kind:'income'},
    {id:'other_income', label:'Other Income', color:'#7CB88F', icon:'gift', kind:'income'},
  ];

  /** Turns a hex colour like "#1F6B4A" into "rgba(31,107,74,alpha)". */
  function hexToRgba(hex, alpha) {
    const n = parseInt(hex.replace('#', ''), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + alpha + ')';
  }

  root.Categories = { BASE_CATS, ICONS, iconSvg, hexToRgba };
})(window);
