# Smart Security Monitor - Установка и Запуск

## Системные требования
- Node.js >= 20.x
- Python >= 3.10
- npm или yarn

## Шаги установки

### 1. Установка Python-зависимостей
```bash
# Убедись, что у тебя есть Python 3.10+
python --version

# Установи Python-пакеты
pip install -r requirements.txt
```

> **Примечание по onnxruntime-openvino:**  
> Пакet `onnxruntime-openvino==1.20.1` в `requirements.txt` помечен как optional для Windows x86_64.
> Если он не устанавливается (нет совместимого wheel), система автоматически работает на `CPUExecutionProvider`
> с оптимизацией потоков (`OMP_NUM_THREADS`/`ORT_NUM_THREADS` под i5-10400). Это нормально.

### 2. Установка Node.js-зависимостей
```bash
npm install
```

### 3. Подготовка базы данных
```bash
npx prisma generate
npx prisma db push
```

## Запуск проекта

### Рекомендуемый способ (одной командой)
```bash
npm run dev
```

Эта команда запустит два сервиса одновременно:
- **Face Server (Python/FastAPI/InsightFace)** на http://localhost:8001
- **Главный сервер (Express/Node.js)** на http://localhost:3000

### Отдельный запуск
```bash
# Только Face Server
npm run dev:face

# Только главный сервер
npm run dev:server
```

## Мониторинг и надежность

### Таймауты и ретраи
- Стандартный запрос к Face Engine: `FACE_REQUEST_TIMEOUT_MS=60000`
- Инференс InsightFace: `FACE_INFERENCE_TIMEOUT_SECONDS=20` (на стороне Python) / `FACE_INFERENCE_TIMEOUT_MS=20000` (Node.js)
- Ретраи: до `FACE_REQUEST_RETRIES=3` с экспоненциальным backoff
- Circuit Breaker: открывается после `FACE_CIRCUIT_BREAKER_THRESHOLD=5` ошибок, cooldown `FACE_CIRCUIT_BREAKER_COOLDOWN_MS=30000`

### Load testing
```bash
node load-test-face.mjs
```

Переменные окружения для теста:
- `FACE_SERVER_URL` — адрес Python-сервера
- `CONCURRENCY` — параллельные запросы
- `REQUESTS` — всего запросов
- `TIMEOUT_MS` — таймаут на запрос

### Логи
- Логи Face Engine: `logs/face.log`
- Логи главного сервера: `logs/app.log`
- Ошибки: `logs/errors.log`

### Рекомендации по production
- Задайте `API_KEY` в `.env` и `VITE_API_KEY` на клиенте
- Настройте ротацию логов и алерты на `504 Gateway Timeout`
- Мониторьте `pythonServerHealthy` в `/api/health`

## Что изменено?
- **Удален face-api.js** (устаревший стек)
- **Добавлен Python-сервер с InsightFace** (современные модели для детекции и распознавания)
- **Добавлено логирование** (лог-файлы в директории `logs/`)
- **Миграция на Prisma** для категорий и персон (хранение данных в БД)
- **Хранение дескрипторов в БД** (не теряются при перезагрузке)
- **Защита от зависаний**: ретраи, circuit breaker, таймауты инференса
- **Настройка камеры**: ROI-зоны детекции, исключающие маски, пресет "металлоискатель"

## Архитектура
```
┌─────────────┐
│   Клиент    │ (React UI)
└──────┬──────┘
       │
       │ API calls
       ↓
┌────────────────────┐
│ Express Server     │ (:3000)
│ └─ face-engine.ts  │
└──────┬─────────────┘
       │
       │ HTTP calls
       ↓
┌─────────────────────┐
│  Python FastAPI     │ (:8001)
│  └─ InsightFace     │
└─────────────────────┘
```
