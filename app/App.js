import React, { useMemo, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';

const GOLD = '#D9A441';
const BG = '#080808';
const CARD = '#111111';

const products = [
  { id: 1, brand: 'Michelin', name: 'Alpin 7', size: '205/55 R16', price: 4890, score: 9.4, season: 'Kış', wet: 'A', fuel: 'B' },
  { id: 2, brand: 'Bridgestone', name: 'Blizzak 6', size: '205/55 R16', price: 4650, score: 9.1, season: 'Kış', wet: 'A', fuel: 'B' },
  { id: 3, brand: 'Lassa', name: 'Snoways 4', size: '195/65 R15', price: 3190, score: 8.8, season: 'Kış', wet: 'B', fuel: 'C' },
  { id: 4, brand: 'Goodyear', name: 'UltraGrip Performance 3', size: '225/45 R17', price: 5750, score: 9.3, season: 'Kış', wet: 'A', fuel: 'B' },
];

function money(v) {
  return new Intl.NumberFormat('tr-TR').format(v) + ' ₺';
}

function Shell() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState('home');
  const [tool, setTool] = useState(null);
  const [query, setQuery] = useState('');
  const [garage, setGarage] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [compare, setCompare] = useState([]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(p => `${p.brand} ${p.name} ${p.size} ${p.season}`.toLowerCase().includes(q));
  }, [query]);

  const openTool = (name) => setTool(name);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />
      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <View style={styles.topbar}>
          <View>
            <Text style={styles.logo}>TOPRAK<Text style={styles.gold}>ONE</Text></Text>
            <Text style={styles.logoSub}>GLOBAL MOBILITY</Text>
          </View>
          <Pressable style={styles.avatar} onPress={() => setTab('profile')}>
            <Text style={styles.avatarText}>ET</Text>
          </Pressable>
        </View>
      </SafeAreaView>

      <View style={styles.body}>
        {tab === 'home' && <Home openTool={openTool} setTab={setTab} />}
        {tab === 'shop' && <Shop query={query} setQuery={setQuery} products={filtered} compare={compare} setCompare={setCompare} alerts={alerts} setAlerts={setAlerts} />}
        {tab === 'garage' && <Garage garage={garage} setGarage={setGarage} />}
        {tab === 'profile' && <Profile alerts={alerts} garage={garage} />}
      </View>

      <View style={[styles.tabbar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        <Tab label="Ana Sayfa" icon="⌂" active={tab === 'home'} onPress={() => setTab('home')} />
        <Tab label="Mağaza" icon="◈" active={tab === 'shop'} onPress={() => setTab('shop')} />
        <Tab label="Garaj" icon="▣" active={tab === 'garage'} onPress={() => setTab('garage')} />
        <Tab label="Hesabım" icon="○" active={tab === 'profile'} onPress={() => setTab('profile')} />
      </View>

      <ToolModal tool={tool} onClose={() => setTool(null)} compare={compare} setCompare={setCompare} alerts={alerts} setAlerts={setAlerts} />
    </View>
  );
}

function Home({ openTool, setTab }) {
  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <View style={styles.heroGlow} />
        <View style={styles.badge}><Text style={styles.badgeText}>TOPRAK ONE • 0.2</Text></View>
        <Text style={styles.eyebrow}>AKILLI SÜRÜŞ ASİSTANI</Text>
        <Text style={styles.heroTitle}>Lastiğini sadece alma.{`\n`}Doğru lastiği <Text style={styles.gold}>seç.</Text></Text>
        <Text style={styles.heroText}>Aracını tanıt, lastik ölçünü kamerayla tara, ürünleri karşılaştır ve fiyat alarmı oluştur.</Text>
        <View style={styles.stats}>
          <Stat value="5.000+" label="STOK" />
          <Stat value="7" label="MARKA" />
          <Stat value="AI" label="ÖNERİ" />
        </View>
      </View>

      <SectionTitle title="Hızlı Başla" right="4 akıllı araç" />
      <View style={styles.grid}>
        <Quick icon="◎" title="Kamerayla Tara" sub="Lastik ölçüsünü okut" onPress={() => openTool('camera')} />
        <Quick icon="AI" title="Akıllı Bulucu" sub="Aracına en uygunu bul" onPress={() => openTool('finder')} />
        <Quick icon="↕" title="Karşılaştır" sub="Fiyat ve performans" onPress={() => openTool('compare')} />
        <Quick icon="⚡" title="Fiyat Alarmı" sub="Düşünce haber ver" onPress={() => openTool('alert')} />
      </View>

      <Pressable style={styles.scanBanner} onPress={() => openTool('camera')}>
        <View style={styles.scanIcon}><Text style={styles.scanIconText}>◎</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.scanTitle}>Kamerayı lastiğe tut</Text>
          <Text style={styles.muted}>Ölçüyü görselden kontrol et ve aramaya aktar.</Text>
        </View>
        <Text style={styles.chev}>›</Text>
      </Pressable>

      <SectionTitle title="Bugünün Önerileri" right="Tümünü gör" onRight={() => setTab('shop')} />
      {products.slice(0, 2).map(p => <ProductCard key={p.id} p={p} />)}
    </ScrollView>
  );
}

function Shop({ query, setQuery, products: list, compare, setCompare, alerts, setAlerts }) {
  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <Text style={styles.eyebrow}>AKILLI MAĞAZA</Text>
      <Text style={styles.pageTitle}>Doğru lastiği bul.</Text>
      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput style={styles.searchInput} value={query} onChangeText={setQuery} placeholder="205/55 R16, Michelin..." placeholderTextColor="#666" />
      </View>
      {list.map(p => (
        <ProductCard
          key={p.id}
          p={p}
          selected={compare.includes(p.id)}
          onCompare={() => setCompare(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : prev.length < 3 ? [...prev, p.id] : prev)}
          onAlert={() => setAlerts(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id])}
          alerting={alerts.includes(p.id)}
        />
      ))}
    </ScrollView>
  );
}

function Garage({ garage, setGarage }) {
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const add = () => {
    if (!brand.trim() || !model.trim()) return Alert.alert('Eksik bilgi', 'Marka ve model gir.');
    setGarage(prev => [...prev, { id: Date.now(), brand: brand.trim(), model: model.trim() }]);
    setBrand(''); setModel('');
  };
  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={styles.eyebrow}>BENİM GARAJIM</Text>
      <Text style={styles.pageTitle}>Aracını kaydet.</Text>
      <Text style={styles.pageText}>Kayıtlı araçlarını daha sonra lastik önerileriyle eşleştireceğiz.</Text>
      <TextInput style={styles.input} value={brand} onChangeText={setBrand} placeholder="Marka (örn. Volkswagen)" placeholderTextColor="#666" />
      <TextInput style={styles.input} value={model} onChangeText={setModel} placeholder="Model (örn. Passat)" placeholderTextColor="#666" />
      <GoldButton label="Aracı Garaja Ekle" onPress={add} />
      {garage.map(v => <View key={v.id} style={styles.menuRow}><Text style={styles.menuText}>{v.brand} {v.model}</Text><Text style={styles.gold}>Kayıtlı</Text></View>)}
    </ScrollView>
  );
}

function Profile({ alerts, garage }) {
  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={styles.eyebrow}>HESABIM</Text>
      <Text style={styles.pageTitle}>Toprak One.</Text>
      <View style={styles.summaryCard}><Text style={styles.summaryValue}>{garage.length}</Text><Text style={styles.muted}>Garajdaki araç</Text></View>
      <View style={styles.summaryCard}><Text style={styles.summaryValue}>{alerts.length}</Text><Text style={styles.muted}>Aktif fiyat alarmı</Text></View>
      {['Siparişlerim','Favorilerim','Destek','Gizlilik ve Ayarlar'].map(x => <View key={x} style={styles.menuRow}><Text style={styles.menuText}>{x}</Text><Text style={styles.chev}>›</Text></View>)}
    </ScrollView>
  );
}

function ToolModal({ tool, onClose, compare, setCompare, alerts, setAlerts }) {
  return (
    <Modal visible={!!tool} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafe} edges={['top','bottom']}>
        <View style={styles.modalHead}>
          <Text style={styles.modalTitle}>{tool === 'camera' ? 'Kamerayla Tara' : tool === 'finder' ? 'Akıllı Bulucu' : tool === 'compare' ? 'Karşılaştır' : 'Fiyat Alarmı'}</Text>
          <Pressable onPress={onClose}><Text style={styles.close}>×</Text></Pressable>
        </View>
        {tool === 'camera' && <CameraTool />}
        {tool === 'finder' && <FinderTool />}
        {tool === 'compare' && <CompareTool compare={compare} setCompare={setCompare} />}
        {tool === 'alert' && <AlertTool alerts={alerts} setAlerts={setAlerts} />}
      </SafeAreaView>
    </Modal>
  );
}

function CameraTool() {
  const [permission, requestPermission] = useCameraPermissions();
  const ref = useRef(null);
  const [captured, setCaptured] = useState(false);
  if (!permission) return <View style={styles.center}><Text style={styles.muted}>Kamera hazırlanıyor...</Text></View>;
  if (!permission.granted) return <View style={styles.center}><Text style={styles.pageText}>Lastik yanağındaki ölçüyü taramak için kamera izni gerekli.</Text><GoldButton label="Kamera İzni Ver" onPress={requestPermission} /></View>;
  const shoot = async () => {
    try { await ref.current?.takePictureAsync({ quality: 0.5 }); setCaptured(true); } catch { Alert.alert('Kamera', 'Fotoğraf alınamadı.'); }
  };
  return (
    <View style={{ flex: 1 }}>
      <CameraView ref={ref} style={styles.camera} facing="back" />
      <View style={styles.cameraOverlay}><Text style={styles.cameraHint}>205/55 R16 gibi ebat yazısını çerçeveye al.</Text></View>
      <Pressable style={styles.shutter} onPress={shoot}><View style={styles.shutterInner} /></Pressable>
      {captured && <View style={styles.notice}><Text style={styles.noticeText}>Fotoğraf alındı. Görsel OCR eşleştirmesi sonraki servis bağlantısında otomatikleşecek.</Text></View>}
    </View>
  );
}

function FinderTool() {
  const [size, setSize] = useState('');
  const [need, setNeed] = useState('Kış');
  const [result, setResult] = useState(null);
  const find = () => {
    const normalized = size.replace(/\s+/g, ' ').trim().toLowerCase();
    const candidates = products.filter(p => (!normalized || p.size.toLowerCase().includes(normalized)) && p.season === need);
    setResult((candidates.length ? candidates : products).sort((a,b) => b.score - a.score)[0]);
  };
  return (
    <ScrollView contentContainerStyle={styles.modalContent}>
      <Text style={styles.pageText}>Ebatı yaz ve kullanım ihtiyacını seç. Toprak One puan/fiyat dengesine göre öneri çıkarır.</Text>
      <TextInput style={styles.input} value={size} onChangeText={setSize} placeholder="Örn. 205/55 R16" placeholderTextColor="#666" />
      <View style={styles.row}>{['Kış','Yaz','4 Mevsim'].map(x => <Pressable key={x} style={[styles.chip, need === x && styles.chipActive]} onPress={() => setNeed(x)}><Text style={[styles.chipText, need === x && styles.chipTextActive]}>{x}</Text></Pressable>)}</View>
      <GoldButton label="En Uygun Lastiği Bul" onPress={find} />
      {result && <ProductCard p={result} />}
    </ScrollView>
  );
}

function CompareTool({ compare, setCompare }) {
  const chosen = products.filter(p => compare.includes(p.id));
  return (
    <ScrollView contentContainerStyle={styles.modalContent}>
      <Text style={styles.pageText}>En fazla 3 ürünü seç. Islak zemin, yakıt, puan ve fiyatı aynı ekranda gör.</Text>
      {products.map(p => <Pressable key={p.id} style={[styles.selectRow, compare.includes(p.id) && styles.selectRowActive]} onPress={() => setCompare(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : prev.length < 3 ? [...prev, p.id] : prev)}><Text style={styles.menuText}>{p.brand} {p.name}</Text><Text style={styles.gold}>{compare.includes(p.id) ? 'Seçildi' : '+'}</Text></Pressable>)}
      {chosen.length > 0 && <View style={styles.compareBox}>{chosen.map(p => <View key={p.id} style={styles.compareCol}><Text style={styles.compareBrand}>{p.brand}</Text><Text style={styles.muted}>{p.size}</Text><Text style={styles.compareScore}>★ {p.score}</Text><Text style={styles.muted}>Islak: {p.wet}</Text><Text style={styles.muted}>Yakıt: {p.fuel}</Text><Text style={styles.price}>{money(p.price)}</Text></View>)}</View>}
    </ScrollView>
  );
}

function AlertTool({ alerts, setAlerts }) {
  return (
    <ScrollView contentContainerStyle={styles.modalContent}>
      <Text style={styles.pageText}>Takip etmek istediğin ürünleri seç. Bildirim altyapısı bağlandığında fiyat düşünce haber vereceğiz.</Text>
      {products.map(p => <Pressable key={p.id} style={[styles.selectRow, alerts.includes(p.id) && styles.selectRowActive]} onPress={() => setAlerts(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id])}><View><Text style={styles.menuText}>{p.brand} {p.name}</Text><Text style={styles.muted}>{money(p.price)}</Text></View><Text style={styles.gold}>{alerts.includes(p.id) ? 'Aktif' : 'Alarm Kur'}</Text></Pressable>)}
    </ScrollView>
  );
}

function ProductCard({ p, selected, onCompare, onAlert, alerting }) {
  return (
    <View style={styles.productCard}>
      <View style={styles.tire}><View style={styles.tireHole}><Text style={styles.tireLabel}>{p.size.split(' ')[1]}</Text></View></View>
      <View style={{ flex: 1 }}>
        <View style={styles.productTop}><Text style={styles.brand}>{p.brand}</Text><Text style={styles.score}>★ {p.score}</Text></View>
        <Text style={styles.productName}>{p.name}</Text>
        <Text style={styles.muted}>{p.size} • {p.season}</Text>
        <Text style={styles.price}>{money(p.price)}</Text>
        {(onCompare || onAlert) && <View style={styles.productActions}>{onCompare && <Pressable onPress={onCompare}><Text style={styles.actionText}>{selected ? '✓ Karşılaştırmada' : '+ Karşılaştır'}</Text></Pressable>}{onAlert && <Pressable onPress={onAlert}><Text style={styles.actionText}>{alerting ? '⚡ Alarm aktif' : '⚡ Alarm kur'}</Text></Pressable>}</View>}
      </View>
    </View>
  );
}

const SectionTitle = ({ title, right, onRight }) => <View style={styles.sectionHead}><Text style={styles.sectionTitle}>{title}</Text><Pressable onPress={onRight}><Text style={styles.sectionRight}>{right}</Text></Pressable></View>;
const Stat = ({ value, label }) => <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
const Quick = ({ icon, title, sub, onPress }) => <Pressable style={styles.quick} onPress={onPress}><View style={styles.quickIcon}><Text style={styles.quickIconText}>{icon}</Text></View><Text style={styles.quickTitle}>{title}</Text><Text style={styles.muted}>{sub}</Text></Pressable>;
const GoldButton = ({ label, onPress }) => <Pressable style={styles.goldButton} onPress={onPress}><Text style={styles.goldButtonText}>{label}</Text></Pressable>;
const Tab = ({ label, icon, active, onPress }) => <Pressable style={styles.tab} onPress={onPress}><Text style={[styles.tabIcon, active && styles.tabActive]}>{icon}</Text><Text style={[styles.tabLabel, active && styles.tabActive]}>{label}</Text></Pressable>;

export default function App() {
  return <SafeAreaProvider><Shell /></SafeAreaProvider>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG }, safeTop: { backgroundColor: BG }, body: { flex: 1 },
  topbar: { minHeight: 64, paddingHorizontal: 20, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#191919' },
  logo: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: 1.3 }, logoSub: { color: '#666', fontSize: 9, letterSpacing: 3, marginTop: 3 }, gold: { color: GOLD },
  avatar: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: '#333', alignItems: 'center', justifyContent: 'center', backgroundColor: '#141414' }, avatarText: { color: GOLD, fontWeight: '800' },
  scroll: { padding: 20, paddingBottom: 38 }, hero: { minHeight: 390, borderRadius: 28, borderWidth: 1, borderColor: '#252525', backgroundColor: CARD, padding: 24, overflow: 'hidden', justifyContent: 'flex-end' },
  heroGlow: { position: 'absolute', width: 260, height: 260, borderRadius: 130, backgroundColor: '#3c2a08', opacity: .75, right: -80, top: -70 },
  badge: { alignSelf: 'flex-start', borderWidth: 1, borderColor: '#5b4214', backgroundColor: '#201a0d', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, marginBottom: 28 }, badgeText: { color: GOLD, fontSize: 11, fontWeight: '700', letterSpacing: 1.7 },
  eyebrow: { color: '#8e8e93', fontSize: 13, fontWeight: '700', letterSpacing: 2.5, marginBottom: 12 }, heroTitle: { color: '#fff', fontSize: 37, lineHeight: 43, fontWeight: '900' }, heroText: { color: '#aaa', fontSize: 16, lineHeight: 25, marginTop: 20 },
  stats: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#2a2a2a', marginTop: 28, paddingTop: 20 }, stat: { flex: 1 }, statValue: { color: '#fff', fontSize: 24, fontWeight: '900' }, statLabel: { color: '#666', fontSize: 10, letterSpacing: 2, marginTop: 5 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 30, marginBottom: 16 }, sectionTitle: { color: '#fff', fontSize: 24, fontWeight: '900' }, sectionRight: { color: '#777', fontSize: 13 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 }, quick: { width: '48%', minHeight: 165, borderRadius: 24, backgroundColor: CARD, borderWidth: 1, borderColor: '#242424', padding: 18, justifyContent: 'flex-end' }, quickIcon: { width: 54, height: 54, borderRadius: 16, backgroundColor: '#201a0d', alignItems: 'center', justifyContent: 'center', marginBottom: 22 }, quickIconText: { color: GOLD, fontSize: 20, fontWeight: '900' }, quickTitle: { color: '#fff', fontSize: 17, fontWeight: '800', marginBottom: 6 }, muted: { color: '#777', fontSize: 13 },
  scanBanner: { marginTop: 18, borderRadius: 24, borderWidth: 1, borderColor: '#4b3814', backgroundColor: '#15120b', padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }, scanIcon: { width: 56, height: 56, borderRadius: 18, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center' }, scanIconText: { fontSize: 25, color: '#111', fontWeight: '900' }, scanTitle: { color: '#fff', fontWeight: '800', fontSize: 16, marginBottom: 4 }, chev: { color: '#777', fontSize: 32 },
  productCard: { flexDirection: 'row', gap: 16, backgroundColor: CARD, borderWidth: 1, borderColor: '#252525', borderRadius: 22, padding: 16, marginBottom: 14 }, tire: { width: 82, height: 82, borderRadius: 41, borderWidth: 13, borderColor: '#292929', alignItems: 'center', justifyContent: 'center', marginTop: 5 }, tireHole: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#090909', alignItems: 'center', justifyContent: 'center' }, tireLabel: { color: '#777', fontSize: 10, fontWeight: '700' }, productTop: { flexDirection: 'row', justifyContent: 'space-between' }, brand: { color: GOLD, fontWeight: '800', fontSize: 12 }, score: { color: '#ddd', fontSize: 12 }, productName: { color: '#fff', fontSize: 17, fontWeight: '800', marginTop: 4, marginBottom: 5 }, price: { color: '#fff', fontSize: 19, fontWeight: '900', marginTop: 10 }, productActions: { flexDirection: 'row', gap: 18, marginTop: 12 }, actionText: { color: GOLD, fontSize: 12, fontWeight: '700' },
  searchBox: { height: 54, borderRadius: 17, backgroundColor: '#121212', borderWidth: 1, borderColor: '#292929', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 18 }, searchIcon: { color: GOLD, fontSize: 22, marginRight: 10 }, searchInput: { flex: 1, color: '#fff', fontSize: 15 }, pageTitle: { color: '#fff', fontSize: 34, fontWeight: '900', marginBottom: 18 }, pageText: { color: '#999', fontSize: 15, lineHeight: 23, marginBottom: 18 },
  input: { height: 54, borderRadius: 16, backgroundColor: '#121212', borderWidth: 1, borderColor: '#292929', color: '#fff', paddingHorizontal: 16, fontSize: 15, marginBottom: 12 }, goldButton: { minHeight: 52, borderRadius: 16, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, marginVertical: 8 }, goldButtonText: { color: '#111', fontWeight: '900', fontSize: 15 },
  menuRow: { minHeight: 64, borderBottomWidth: 1, borderBottomColor: '#202020', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, menuText: { color: '#fff', fontSize: 15, fontWeight: '700' }, summaryCard: { backgroundColor: CARD, borderRadius: 20, borderWidth: 1, borderColor: '#252525', padding: 18, marginBottom: 12 }, summaryValue: { color: '#fff', fontSize: 28, fontWeight: '900', marginBottom: 5 },
  tabbar: { backgroundColor: '#0d0d0d', borderTopWidth: 1, borderTopColor: '#242424', flexDirection: 'row', paddingTop: 8, minHeight: 64 }, tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 }, tabIcon: { color: '#5f5f5f', fontSize: 20 }, tabLabel: { color: '#5f5f5f', fontSize: 10, fontWeight: '700' }, tabActive: { color: GOLD },
  modalSafe: { flex: 1, backgroundColor: BG }, modalHead: { minHeight: 64, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#222' }, modalTitle: { color: '#fff', fontSize: 22, fontWeight: '900' }, close: { color: '#fff', fontSize: 34, fontWeight: '300' }, modalContent: { padding: 20, paddingBottom: 40 }, center: { flex: 1, justifyContent: 'center', padding: 24 },
  camera: { flex: 1, margin: 18, borderRadius: 24, overflow: 'hidden' }, cameraOverlay: { position: 'absolute', left: 38, right: 38, top: 60, borderWidth: 1, borderColor: GOLD, borderRadius: 18, padding: 18, backgroundColor: '#00000066' }, cameraHint: { color: '#fff', textAlign: 'center', fontWeight: '700' }, shutter: { position: 'absolute', bottom: 30, alignSelf: 'center', width: 78, height: 78, borderRadius: 39, borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' }, shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: GOLD }, notice: { position: 'absolute', left: 24, right: 24, bottom: 120, backgroundColor: '#111', borderRadius: 14, padding: 12 }, noticeText: { color: '#ddd', fontSize: 12, lineHeight: 18 },
  row: { flexDirection: 'row', gap: 8, marginBottom: 12 }, chip: { borderWidth: 1, borderColor: '#333', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 }, chipActive: { borderColor: GOLD, backgroundColor: '#211a0d' }, chipText: { color: '#888', fontWeight: '700' }, chipTextActive: { color: GOLD },
  selectRow: { minHeight: 68, borderWidth: 1, borderColor: '#252525', borderRadius: 18, padding: 15, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: CARD }, selectRowActive: { borderColor: GOLD, backgroundColor: '#17140d' }, compareBox: { flexDirection: 'row', gap: 8, marginTop: 12 }, compareCol: { flex: 1, borderWidth: 1, borderColor: '#292929', borderRadius: 16, padding: 12, backgroundColor: CARD }, compareBrand: { color: GOLD, fontSize: 12, fontWeight: '900', marginBottom: 5 }, compareScore: { color: '#fff', fontWeight: '800', marginVertical: 7 },
});
