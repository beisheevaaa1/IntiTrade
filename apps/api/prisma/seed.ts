import { PrismaClient, ListingCondition, ListingStatus, ListingType, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const categories = [
  ["Textbooks", "textbooks"],
  ["Electronics", "electronics"],
  ["Dorm essentials", "dorm-essentials"],
  ["Tutoring", "tutoring"],
  ["Creative services", "creative-services"],
  ["Transport", "transport"],
  ["Sports", "sports"],
  ["Clothing", "clothing"]
] as const;

const demoListings = [
  {
    title: "MacBook Air M1 for coursework",
    description: "Clean laptop, 8GB RAM, 256GB SSD. Battery is strong and it is ready for coding, writing papers, and online classes.",
    price: "520.00",
    type: ListingType.PRODUCT,
    condition: ListingCondition.LIKE_NEW,
    status: ListingStatus.ACTIVE,
    location: "Main Library",
    categorySlug: "electronics"
  },
  {
    title: "Calculus textbook, 9th edition",
    description: "Clean copy with a few pencil notes. Good for first-year math courses and exam preparation.",
    price: "35.00",
    type: ListingType.PRODUCT,
    condition: ListingCondition.GOOD,
    status: ListingStatus.ACTIVE,
    location: "Science Building",
    categorySlug: "textbooks"
  },
  {
    title: "React tutoring before finals",
    description: "One-on-one help with JavaScript, React basics, hooks, routing, and debugging assignments.",
    price: "14.00",
    type: ListingType.SERVICE,
    condition: ListingCondition.NOT_APPLICABLE,
    status: ListingStatus.ACTIVE,
    location: "Engineering Building",
    categorySlug: "tutoring"
  },
  {
    title: "Dorm mini fridge",
    description: "Compact fridge for dorm room. Works well, clean inside, easy pickup near student residence.",
    price: "48.00",
    type: ListingType.PRODUCT,
    condition: ListingCondition.GOOD,
    status: ListingStatus.ACTIVE,
    location: "Dormitory B",
    categorySlug: "dorm-essentials"
  },
  {
    title: "Poster design service",
    description: "I can design clean posters for student clubs, events, presentations, and small campus campaigns.",
    price: "18.00",
    type: ListingType.SERVICE,
    condition: ListingCondition.NOT_APPLICABLE,
    status: ListingStatus.ACTIVE,
    location: "Media Lab",
    categorySlug: "creative-services"
  },
  {
    title: "Airport ride share",
    description: "Shared ride to the airport on Friday evening. Two seats available, split fuel cost.",
    price: "9.00",
    type: ListingType.SERVICE,
    condition: ListingCondition.NOT_APPLICABLE,
    status: ListingStatus.PENDING,
    location: "Main Gate",
    categorySlug: "transport"
  }
] as const;

async function main() {
  for (const [name, slug] of categories) {
    await prisma.category.upsert({
      where: { slug },
      update: { name },
      create: { name, slug }
    });
  }

  const adminPassword = await bcrypt.hash("Admin12345!", 12);
  const studentPassword = await bcrypt.hash("Student12345!", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@gmail.com" },
    update: { name: "Marketplace Admin", role: Role.ADMIN, isVerified: true },
    create: {
      email: "admin@gmail.com",
      name: "Marketplace Admin",
      passwordHash: adminPassword,
      role: Role.ADMIN,
      isVerified: true
    }
  });

  const diana = await prisma.user.upsert({
    where: { email: "diana@gmail.com" },
    update: { name: "Diana A.", isVerified: true },
    create: {
      email: "diana@gmail.com",
      name: "Diana A.",
      passwordHash: studentPassword,
      role: Role.STUDENT,
      isVerified: true
    }
  });

  const emil = await prisma.user.upsert({
    where: { email: "emil@gmail.com" },
    update: { name: "Emil K.", isVerified: true },
    create: {
      email: "emil@gmail.com",
      name: "Emil K.",
      passwordHash: studentPassword,
      role: Role.STUDENT,
      isVerified: true
    }
  });

  const titles = demoListings.map((listing) => listing.title);
  const existing = await prisma.listing.findMany({ where: { title: { in: titles } }, select: { id: true } });
  const listingIds = existing.map((listing) => listing.id);
  await prisma.report.deleteMany({ where: { listingId: { in: listingIds } } });
  await prisma.favorite.deleteMany({ where: { listingId: { in: listingIds } } });
  await prisma.message.deleteMany({ where: { conversation: { listingId: { in: listingIds } } } });
  await prisma.conversation.deleteMany({ where: { listingId: { in: listingIds } } });
  await prisma.listingImage.deleteMany({ where: { listingId: { in: listingIds } } });
  await prisma.listing.deleteMany({ where: { id: { in: listingIds } } });

  const createdListings = [];
  for (const [index, listing] of demoListings.entries()) {
    const category = await prisma.category.findUniqueOrThrow({ where: { slug: listing.categorySlug } });
    const seller = index % 2 === 0 ? diana : emil;
    createdListings.push(await prisma.listing.create({
      data: {
        title: listing.title,
        description: listing.description,
        price: listing.price,
        type: listing.type,
        condition: listing.condition,
        status: listing.status,
        location: listing.location,
        sellerId: seller.id,
        categoryId: category.id
      }
    }));
  }

  const firstListing = createdListings[0];
  const conversation = await prisma.conversation.create({
    data: {
      listingId: firstListing.id,
      buyerId: emil.id,
      sellerId: diana.id
    }
  });

  await prisma.message.createMany({
    data: [
      { conversationId: conversation.id, senderId: emil.id, body: "Hi, is the MacBook still available?" },
      { conversationId: conversation.id, senderId: diana.id, body: "Yes, I can meet near the main library after 4 PM." }
    ]
  });

  await prisma.favorite.create({
    data: { userId: emil.id, listingId: firstListing.id }
  });

  await prisma.report.create({
    data: {
      reporterId: diana.id,
      listingId: createdListings[5].id,
      reason: "Needs admin review",
      details: "Ride share listing should be checked before approval."
    }
  });

  await prisma.emailVerificationToken.deleteMany({
    where: { userId: { in: [admin.id, diana.id, emil.id] } }
  });
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
