// ---------- Данные каталога ----------

const PRODUCTS = [
  { id: "chanel-25", name: "CHANEL 25 SMALL HANDBAG", price: 980000, color: "#e0708c", image: "chanel-25-small-handbag.png" },
  { id: "classic-1112-a", name: "КЛАССИЧЕСКАЯ СУМКА 11.12", price: 650000, color: "#d88ba0", image: "klassicheskaya-sumka-1112-a.png" },
  { id: "classic-1112-b", name: "КЛАССИЧЕСКАЯ СУМКА 11.12", price: 720000, color: "#c46b8a", image: "klassicheskaya-sumka-1112-b.png" },
  { id: "shopping-large", name: "СУМКА SHOPPING БОЛЬШОГО РАЗМЕРА", price: 560000, color: "#e6a0b5", image: "sumka-shopping-bolshogo-razmera.png" },
  { id: "shopping-small-a", name: "СУМКА SHOPPING МАЛЕНЬКОГО РАЗМЕРА", price: 610000, color: "#b8607f", image: "sumka-shopping-malenkogo-razmera-a.png" },
  { id: "shopping-small-b", name: "СУМКА SHOPPING МАЛЕНЬКОГО РАЗМЕРА", price: 590000, color: "#ec9db0", image: "sumka-shopping-malenkogo-razmera-b.png" },
  { id: "envelope-a", name: "СУМКА-КОНВЕРТ", price: 530000, color: "#a85570", image: "sumka-konvert-a.png" },
  { id: "envelope-b", name: "СУМКА-КОНВЕРТ", price: 545000, color: "#f0b6c4", image: "sumka-konvert-b.png" },
];

const CART_STORAGE_KEY = "bagShopCart";

// ---------- Иконка сумки (запасной вариант, если фото товара ещё не добавлено) ----------

function bagIconSVG(color) {
  return `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M6 8H18L17 21H7L6 8Z" stroke="${color}" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M9 8V6C9 3.79086 10.7909 2 13 2C15.2091 2 17 3.79086 17 6V8" stroke="${color}" stroke-width="1.5"/>
    </svg>
  `;
}

// Картинка товара: пытаемся показать фото из /images, если файла нет — остаётся иконка-заглушка
function productImageHTML(product) {
  return `<img src="images/${product.image}" alt="${product.name}" class="card__photo" data-fallback-for="${product.id}">`;
}

// Если фото не загрузилось (файла ещё нет в /images) — подменяем на цветную иконку
function attachImageFallbacks(container) {
  container.querySelectorAll("img[data-fallback-for]").forEach((img) => {
    img.addEventListener("error", () => {
      const product = PRODUCTS.find((p) => p.id === img.dataset.fallbackFor);
      const fallback = document.createElement("div");
      fallback.className = "card__fallback";
      fallback.innerHTML = bagIconSVG(product.color);
      img.replaceWith(fallback);
    }, { once: true });
  });
}

// ---------- Состояние корзины ----------
// cart хранится как объект { [productId]: quantity }

function loadCart() {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
}

let cart = loadCart();

function formatPrice(value) {
  return value.toLocaleString("ru-RU");
}

// ---------- Рендер каталога ----------

const catalogEl = document.getElementById("catalog");

function renderCatalog() {
  catalogEl.innerHTML = PRODUCTS.map((product) => `
    <article class="card">
      <div class="card__image" style="background:${product.color}1a">
        ${productImageHTML(product)}
      </div>
      <div class="card__body">
        <h3 class="card__title">${product.name}</h3>
        <p class="card__price">${formatPrice(product.price)} ₽</p>
        <div class="card__actions">
          <button class="btn" data-add="${product.id}">Добавить в корзину</button>
        </div>
      </div>
    </article>
  `).join("");

  attachImageFallbacks(catalogEl);
}

// ---------- Рендер корзины ----------

const cartListEl = document.getElementById("cartList");
const cartEmptyEl = document.getElementById("cartEmpty");
const cartTotalEl = document.getElementById("cartTotal");
const cartCountEl = document.getElementById("cartCount");

function getCartEntries() {
  return Object.entries(cart)
    .map(([id, qty]) => ({ product: PRODUCTS.find((p) => p.id === id), qty }))
    .filter((entry) => entry.product && entry.qty > 0);
}

function renderCart() {
  const entries = getCartEntries();

  cartListEl.innerHTML = entries.map(({ product, qty }) => `
    <li class="cart-item">
      <div class="cart-item__icon" style="background:${product.color}1a">
        ${productImageHTML(product)}
      </div>
      <div class="cart-item__info">
        <p class="cart-item__name">${product.name}</p>
        <p class="cart-item__price">${formatPrice(product.price)} ₽</p>
      </div>
      <div class="cart-item__qty">
        <button class="btn btn--qty" data-decrease="${product.id}" aria-label="Уменьшить количество">-</button>
        <span>${qty}</span>
        <button class="btn btn--qty" data-increase="${product.id}" aria-label="Увеличить количество">+</button>
      </div>
      <button class="btn btn--remove" data-remove="${product.id}" aria-label="Удалить товар">&times;</button>
    </li>
  `).join("");

  attachImageFallbacks(cartListEl);

  cartEmptyEl.style.display = entries.length === 0 ? "block" : "none";

  const total = entries.reduce((sum, { product, qty }) => sum + product.price * qty, 0);
  const count = entries.reduce((sum, { qty }) => sum + qty, 0);

  cartTotalEl.textContent = formatPrice(total);
  cartCountEl.textContent = count;
}

function updateCart(newCart) {
  cart = newCart;
  saveCart(cart);
  renderCart();
}

// ---------- Действия с корзиной ----------

function addToCart(productId) {
  const next = { ...cart, [productId]: (cart[productId] || 0) + 1 };
  updateCart(next);
}

function increaseQty(productId) {
  addToCart(productId);
}

function decreaseQty(productId) {
  const next = { ...cart };
  if (!next[productId]) return;
  next[productId] -= 1;
  if (next[productId] <= 0) delete next[productId];
  updateCart(next);
}

function removeFromCart(productId) {
  const next = { ...cart };
  delete next[productId];
  updateCart(next);
}

// ---------- Модальные окна ----------

const cartModal = document.getElementById("cartModal");
const orderModal = document.getElementById("orderModal");

function openModal(modal) {
  modal.setAttribute("data-open", "true");
  modal.setAttribute("aria-hidden", "false");
}

function closeModal(modal) {
  modal.setAttribute("data-open", "false");
  modal.setAttribute("aria-hidden", "true");
}

document.getElementById("cartBtn").addEventListener("click", () => openModal(cartModal));

document.querySelectorAll("[data-close-cart]").forEach((el) =>
  el.addEventListener("click", () => closeModal(cartModal))
);

document.querySelectorAll("[data-close-order]").forEach((el) =>
  el.addEventListener("click", () => closeModal(orderModal))
);

document.getElementById("checkoutBtn").addEventListener("click", () => {
  if (getCartEntries().length === 0) return;
  closeModal(cartModal);
  openModal(orderModal);
});

// ---------- Делегирование кликов по каталогу и корзине ----------

catalogEl.addEventListener("click", (event) => {
  const addId = event.target.closest("[data-add]")?.dataset.add;
  if (addId) addToCart(addId);
});

cartListEl.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target) return;

  if (target.dataset.increase) increaseQty(target.dataset.increase);
  if (target.dataset.decrease) decreaseQty(target.dataset.decrease);
  if (target.dataset.remove) removeFromCart(target.dataset.remove);
});

// ---------- Форма заказа ----------

const orderForm = document.getElementById("orderForm");
const orderSuccessEl = document.getElementById("orderSuccess");

orderForm.addEventListener("submit", (event) => {
  event.preventDefault();

  orderForm.style.display = "none";
  orderSuccessEl.style.display = "block";

  updateCart({});

  setTimeout(() => {
    closeModal(orderModal);
    orderForm.reset();
    orderForm.style.display = "flex";
    orderSuccessEl.style.display = "none";
  }, 1800);
});

// ---------- Инициализация ----------

renderCatalog();
renderCart();
