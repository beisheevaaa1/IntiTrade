# 🗄️ IntiTrade: Архитектура Базы Данных и UML Диаграмма классов

В данном документе представлена подробная структура базы данных проекта **IntiTrade**, визуализированная в виде цветовой UML диаграммы классов. Структура полностью соответствует реальной схеме `schema.prisma` и использует цветовую кодировку по функциональным доменам для удобства восприятия разработчиками.

---

## 🎨 Цветовая легенда функциональных блоков

* 🔴 **Красный блок (Учетные записи и безопасность)**: `User`, `EmailVerificationToken`, `Notification`. Ответственность за профили студентов, проверку доменов университета и отправку уведомлений.
* 🔵 **Синий блок (Каталог и товары)**: `Listing`, `Category`, `ListingImage`, `Favorite`. Ответственность за маркетплейс, характеристики товаров (валюта **RM**, торг, состояние), категории и избранное.
* 🟡 **Желтый блок (Коммуникации и сделки)**: `Conversation`, `Message`. Ответственность за изолированные p2p-чаты по каждому отдельному товару.
* 🟢 **Зеленый блок (Модерация и аудит)**: `Report`, `AdminActionLog`. Ответственность за жалобы, безопасность кампуса и прозрачность действий администратора.

---

## 📊 UML Диаграмма классов Базы Данных (Mermaid)

```mermaid
classDiagram
    direction TB

    %% ----------------------------------------------------
    %% 🔴 БЛОК 1: ПОЛЬЗОВАТЕЛИ И ВЕРИФИКАЦИЯ (КРАСНЫЙ)
    %% ----------------------------------------------------
    class User {
      +String id [PK]
      +String email [Unique]
      +String name
      +String passwordHash
      +Role role [STUDENT/ADMIN]
      +Boolean isVerified
      +Boolean isBlocked
      +String faculty
      +String campusArea
      +String bio
      +String avatarUrl
      +DateTime createdAt
    }
    style User fill:#FEE2E2,stroke:#DC2626,stroke-width:2px,color:#991B1B

    class EmailVerificationToken {
      +String id [PK]
      +String token [Unique]
      +String userId [FK]
      +DateTime expiresAt
    }
    style EmailVerificationToken fill:#FEE2E2,stroke:#DC2626,stroke-width:2px,color:#991B1B

    class Notification {
      +String id [PK]
      +String userId [FK]
      +String type
      +String payload
      +DateTime readAt
    }
    style Notification fill:#FEE2E2,stroke:#DC2626,stroke-width:2px,color:#991B1B


    %% ----------------------------------------------------
    %% 🔵 БЛОК 2: КАТАЛОГ И ОБЪЯВЛЕНИЯ (СИНИЙ)
    %% ----------------------------------------------------
    class Category {
      +String id [PK]
      +String name [Unique]
      +String slug [Unique]
    }
    style Category fill:#E0F2FE,stroke:#0284C7,stroke-width:2px,color:#075985

    class Listing {
      +String id [PK]
      +String title
      +String description
      +Decimal price [RM]
      +ListingType type [PRODUCT/SERVICE]
      +ListingCondition condition
      +ListingStatus status
      +String location
      +String meetupPreference
      +Boolean isNegotiable
      +Int viewsCount
      +String rejectionReason
      +String sellerId [FK]
      +String categoryId [FK]
    }
    style Listing fill:#E0F2FE,stroke:#0284C7,stroke-width:2px,color:#075985

    class ListingImage {
      +String id [PK]
      +String url
      +String listingId [FK]
    }
    style ListingImage fill:#E0F2FE,stroke:#0284C7,stroke-width:2px,color:#075985

    class Favorite {
      +String id [PK]
      +String userId [FK]
      +String listingId [FK]
    }
    style Favorite fill:#E0F2FE,stroke:#0284C7,stroke-width:2px,color:#075985


    %% ----------------------------------------------------
    %% 🟡 БЛОК 3: ЧАТ И СООБЩЕНИЯ (ЖЕЛТЫЙ)
    %% ----------------------------------------------------
    class Conversation {
      +String id [PK]
      +String listingId [FK]
      +String buyerId [FK]
      +String sellerId [FK]
    }
    style Conversation fill:#FEF3C7,stroke:#D97706,stroke-width:2px,color:#92400E

    class Message {
      +String id [PK]
      +String conversationId [FK]
      +String senderId [FK]
      +String body
      +DateTime readAt
    }
    style Message fill:#FEF3C7,stroke:#D97706,stroke-width:2px,color:#92400E


    %% ----------------------------------------------------
    %% 🟢 БЛОК 4: МОДЕРАЦИЯ И БЕЗОПАСНОСТЬ (ЗЕЛЕНЫЙ)
    %% ----------------------------------------------------
    class Report {
      +String id [PK]
      +String reason
      +String details
      +ReportStatus status
      +String reporterId [FK]
      +String listingId [FK]
    }
    style Report fill:#D1FAE5,stroke:#059669,stroke-width:2px,color:#065F46

    class AdminActionLog {
      +String id [PK]
      +String adminId [FK]
      +String action
      +String entityType
      +String entityId
      +String reason
    }
    style AdminActionLog fill:#D1FAE5,stroke:#059669,stroke-width:2px,color:#065F46


    %% ----------------------------------------------------
    %% СВЯЗИ МЕЖДУ СУЩНОСТЯМИ
    %% ----------------------------------------------------
    User "1" -- "0..*" EmailVerificationToken : has
    User "1" -- "0..*" Notification : receives
    User "1" -- "0..*" Listing : creates (Seller)
    User "1" -- "0..*" Favorite : saves
    User "1" -- "0..*" Conversation : participates (Buyer/Seller)
    User "1" -- "0..*" Message : sends
    User "1" -- "0..*" Report : submits
    User "1" -- "0..*" AdminActionLog : performs (Admin)

    Category "1" -- "0..*" Listing : classifies
    Listing "1" -- "1..*" ListingImage : contains
    Listing "1" -- "0..*" Favorite : saved in
    Listing "1" -- "0..*" Conversation : subject of
    Listing "1" -- "0..*" Report : target of

    Conversation "1" -- "1..*" Message : contains
```

---

## 🛠️ Описание ключевых связей и правил целостности

1. **Каскадное удаление (OnDelete: Cascade)**:
   * При удалении пользователя (`User`) автоматически удаляются все его токены верификации, избранные товары, уведомления и отправленные сообщения.
   * При удалении объявления (`Listing`) автоматически очищаются его фотографии (`ListingImage`), отметки в избранном и связанные диалоги.
2. **Уникальные индексы (Unique Constraints)**:
   * **`Favorite`**: Уникальный составной ключ `[userId, listingId]` предотвращает дублирование одного и того же товара в избранном у студента.
   * **`Conversation`**: Уникальный составной ключ `[listingId, buyerId, sellerId]` гарантирует, что между покупателем и продавцом по одному товару существует только один общий диалог.
3. **Оптимизация производительности (Indexes)**:
   * Настроены индексы по полям фильтрации `@@index([status, type])` в таблице `Listing` для мгновенной выборки объявлений в главной ленте маркетплейса.
