# LampFactory Storefront

Пользовательская часть интернет-магазина на React + React Router DOM.

Реализованные страницы:

- `/catalog` — каталог с поиском, фильтрами и сортировкой.
- `/product/:slug` — карточка товара.
- `/cart` — корзина с изменением количества и удалением товаров.
- `/checkout` — оформление заказа.
- `/checkout/success/:orderNumber` — подтверждение заказа.

Данные товаров загружаются из `products-service`, оформление заказа выполняется через `orders-service`. Глобальное состояние товаров, корзины и последнего заказа хранится в Redux.

По умолчанию frontend ожидает сервисы здесь:

- products-service: `http://127.0.0.1:8001`
- orders-service: `http://127.0.0.1:8002`

Адреса можно переопределить через переменные Vite:

```bash
VITE_PRODUCTS_API_URL=http://127.0.0.1:8001
VITE_ORDERS_API_URL=http://127.0.0.1:8002
```

Корзина и последний созданный заказ дополнительно сохраняются в `localStorage`, чтобы состояние не терялось при обновлении страницы.

## Запуск

```bash
npm install
npm run dev
```

Если Node установлен в Windows и не виден из WSL как `node`, можно запускать так:

```bash
PATH="/mnt/c/Program Files/nodejs:$PATH" npm run dev
```

Production-сборка:

```bash
npm run build
```
