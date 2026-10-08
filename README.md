# EMA Reader

Chrome'da fareyle seçtiğin Türkçe metni **EMA Lightning** modeliyle sesli okuyan bir eklenti.
Ses bilgisayarındaki yerel bir Python sunucusunda üretilir; metin internete gitmez, ücret yoktur.

> **Yapay zekâ sesi:** Okunan ses EMA Lightning yapay zekâ modeliyle üretilir, gerçek bir kişinin sesi değildir.
> Eklenti bunu balonda ve açılır pencerede "AI sesi" etiketiyle belirtir.

```
ema-reader/
  server/      Python sunucusu (FastAPI + EMA Lightning), 127.0.0.1:8765
  extension/   Chrome eklentisi (Manifest V3, Vite + React + TypeScript)
```

## Gereksinimler

- **Python 3.11, 3.12 veya 3.13** (EMA Lightning daha eski veya yeni sürümleri desteklemiyor). Kontrol: `python --version`
- **Node.js 20 veya üstü** (yalnızca eklentiyi derlemek için)
- Google Chrome
- İnternet yalnızca ilk kurulumda gerekir (paketler ve ~34 MB model dosyası). Sonrasında her şey çevrimdışı çalışır.

## 1. Sunucuyu kur

EMA Lightning, `pip install ema-lightning` ile kurulan bir Python paketidir. Model ağırlıkları
(`ema.pt`, `decoder.pt`, toplam ~34 MB) sunucu ilk açıldığında Hugging Face'ten
([canberkkkkkk/ema-lightning](https://huggingface.co/canberkkkkkk/ema-lightning)) kendiliğinden iner ve önbelleğe alınır.

**Windows:**

1. Python 3.13'ü kur (3.14 desteklenmiyor; bilgisayarında 3.14 varsa yanında 3.13 da durabilir).
   Komut İstemi'nde: `winget install Python.Python.3.13`
   veya [python.org](https://www.python.org/downloads/windows/) üzerinden "Python 3.13" yükleyicisini indir.
2. `server\kurulum.bat` dosyasına çift tıkla. Uygun Python sürümünü bulur, `.venv` sanal ortamını oluşturur
   ve gerekli paketleri (PyTorch dahil, birkaç yüz MB) kurar.

Elle yapmak istersen:

```bat
cd ema-reader\server
py -3.13 -m venv .venv
.venv\Scripts\python -m pip install --upgrade pip
.venv\Scripts\python -m pip install -r requirements.txt
```

**macOS / Linux:**

```sh
cd ema-reader/server
python3 -m venv .venv
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -r requirements.txt
```

`requirements.txt` PyTorch'u da kurar. Windows'ta varsayılan PyTorch yalnızca CPU sürümüdür; model CPU'da da
gerçek zamandan hızlı çalışır. **NVIDIA ekran kartın varsa** ve daha hızlı olsun istersen, `requirements.txt`'den
önce [pytorch.org](https://pytorch.org/get-started/locally/) sayfasının verdiği CUDA'lı `pip install torch ...`
komutunu aynı `.venv` içinde çalıştır. Sunucu GPU'yu kendisi bulur.

## 2. Sunucuyu başlat

- Windows: `server\run.bat` dosyasına çift tıkla veya komut satırından çalıştır.
- macOS / Linux: `./server/run.sh`

İlk açılışta model indirilir, birkaç saniye sürebilir. `Application startup complete` yazısını görünce hazırdır.
Sunucu açık kaldığı sürece eklenti çalışır; pencereyi kapatınca sunucu da durur.

Denemek için:

```sh
curl http://127.0.0.1:8765/health
curl -X POST http://127.0.0.1:8765/say -H "Content-Type: application/json" -d "{\"text\":\"Merhaba dünya.\", \"speed\": 1.0}" -o deneme.wav
```

## 3. Eklentiyi derle ve yükle

```sh
cd ema-reader/extension
npm install
npm run build
```

1. Chrome'da `chrome://extensions` adresini aç.
2. Sağ üstten **Geliştirici modu**'nu aç.
3. **Paketlenmemiş öğe yükle** ile `ema-reader/extension/dist` klasörünü seç.
4. Eklentiyi araç çubuğuna sabitle (yapboz simgesi → EMA Reader → raptiye).

Kodu değiştirince `npm run build` çalıştırıp `chrome://extensions` sayfasında eklentinin yenile düğmesine bas.

## Kullanım

1. Sunucunun çalıştığından emin ol (eklenti simgesine tıklayınca yeşil nokta görünür).
2. Herhangi bir sayfada metni fareyle seç.
3. Seçimin yanında çıkan **▶** balonuna tıkla ya da **Alt+S**'ye bas. Metin cümle cümle okunur, okunan kelime sayfada sarıyla vurgulanır.
4. Okuma başlayınca sağ alt köşede küçük bir oynatıcı çıkar: **❚❚** duraklatır, **▶** devam ettirir, **■** durdurur.
   Okuma sürerken **Alt+S** de okumayı durdurur.
5. Okuma sürerken başka bir metin seçip okutursan önceki okuma durur, yenisi başlar.

Eklenti simgesindeki pencereden okuma hızını (0,75x–2x) ayarlayabilir, balonu ve vurgulamayı açıp kapatabilir,
sunucu portunu değiştirebilirsin. Hızı okuma sırasında değiştirirsen yeni hız birkaç cümle sonra devreye girer
(sıradaki cümle önceden hazırlanmış olur).

Alt+S başka bir eklentiyle çakışırsa Chrome kısayolu atamayabilir; `chrome://extensions/shortcuts` sayfasından
EMA Reader için istediğin tuşu seçebilirsin.

## Geliştirme

```sh
cd extension
npm test           # cümle bölme birim testleri
npm run typecheck  # tsc --noEmit
```

Nasıl çalışır: içerik betiği seçimi cümlelere böler ve arka plana yollar. Arka plan bir **offscreen belgesi** açar;
sunucuya istekleri bu belge atar ve sesi Web Audio ile çalar (HTTPS sayfalardan `localhost`'a doğrudan istek
tarayıcı tarafından engellendiği için). Bir cümle çalarken sonraki önceden istenir. Kelime vurgusu, cümle süresinin
karakter sayısına göre kelimelere paylaştırılmasıyla tahmin edilir ve sayfa DOM'u değiştirilmeden
CSS Custom Highlight API ile çizilir.

## Bilinen sınırlar

- Yalnızca Türkçe ve tek ses.
- CPU'da ilk cümle uzunluğuna göre bir-iki saniyede başlar; GPU'da neredeyse anında.
- Kelime vurgusu tahminidir, uzun sayılar veya kısaltmalar okunurken biraz kayabilir.
- "Buradan sonrasını oku" henüz yok.
- Sunucu kapalıysa balonda ve açılır pencerede "EMA sunucusu çalışmıyor" uyarısı çıkar.

## Lisans ve model

EMA Lightning, Canberk Aslan tarafından Apache 2.0 lisansıyla yayımlanmıştır:
[Hugging Face](https://huggingface.co/canberkkkkkk/ema-lightning) · [GitHub](https://github.com/canberk7/ema-lightning).
Model kartının istediği gibi, bu sesi yayımlarken veya başkalarına dinletirken yapay zekâ ile üretildiğini belirt.
