# تشغيل IBRAXIS 0.3
## Windows
ثبت Node.js 22.13 أو أحدث ضمن سلسلة 22. فك الضغط ثم انقر START-WINDOWS.cmd. اختر كلمة مرور طويلة (تظهر أثناء الكتابة) عند أول تشغيل. افتح http://localhost:3000 ولوحة الإدارة http://localhost:3000/admin. لا تغلق النافذة أثناء الاستخدام. لا تشارك كلمة المرور. قاعدة البيانات داخل data المستبعد من Git.
## GitHub Codespaces (تجربة خاصة، وليست استضافة دائمة)
أنشئ مستودعًا خاصًا وارفع محتويات المجلد بما فيها .devcontainer و.github و.gitignore. من Code > Codespaces > Create codespace on main. في Terminal نفذ:
```bash
read -rsp 'Owner password: ' OWNER_PASSWORD; echo; export OWNER_PASSWORD
npm start
```
افتح المنفذ 3000 من Ports واتركه Private. توقف Codespaces عند عدم الاستخدام أو نفاد الحصة؛ لا تستخدمه كاستضافة إنتاج ولا تخزن بيانات حقيقية فيه قبل ترتيبات النسخ الاحتياطي.
## AI
ثبت Ollama محليًا واختر نموذجًا متاحًا لديك. قبل npm.cmd start في CMD نفذ set OLLAMA_MODEL=YOUR_INSTALLED_MODEL (استبدل الاسم). عنوان Ollama الافتراضي http://127.0.0.1:11434. لا تفتح منفذ Ollama للعامة. المساعد ينشئ مسودات فقط ولا يعدل الكود أو ينشر تلقائيًا. يحتاج الخادم للوصول إلى Ollama؛ تشغيله على جهازك لا يجعله متاحًا لخادم GitHub.
## نشر دائم
Dockerfile مرفق لكن بناء الصورة غير مختبر. يحتاج مضيف Node/Docker مع قرص دائم مربوط /app/data وHTTPS وSECURE_COOKIE=1 وOWNER_PASSWORD كسر عند أول تشغيل. GitHub Pages لا يشغل هذا الخادم. لا تنشر بيانات حقيقية قبل مراجعة الأمان والنسخ الاحتياطي. لا توجد خدمة استضافة مفعلة أو مدفوعة.

V0.9: `PUBLIC_SITE_URL` must be the actual production HTTPS origin. Do not use on staging; with no value the app opts out of indexing. Configure permanent storage, HTTPS and SECURE_COOKIE=1 before live deployment. Submit generated sitemap manually via Search Console and Bing Webmaster Tools; measure Core Web Vitals on the live URL. No claim of verified live performance or ranking.

## V1.0 hybrid deployment override
Follow STORAGE-AR.md; provision persistent disk for DATA_DIR (default `data/ecosystem.sqlite.files`) plus private GitHub data repository via GITHUB_DATA_REPO/GITHUB_DATA_TOKEN. No external database service. Keep all data and .env outside source control, and restore/troubleshoot from private snapshots. Codespaces is development only; keep port private. No multi-instance deployments. Verify remote sync and recovery before any production use.
