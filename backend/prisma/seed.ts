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

// Create lists of titles, descriptions and high-quality Unsplash image URLs for listings
const listingTemplates = [
  {
    title: "Calculus Early Transcendentals 8th Edition",
    description: "Mint condition, used for first semester math course. No marks or highlights inside.",
    price: "85.00",
    type: ListingType.PRODUCT,
    condition: ListingCondition.LIKE_NEW,
    categorySlug: "textbooks",
    imageUrl: "/uploads/calculus.jpg"
  },
  {
    title: "iPad Air 4th Generation 64GB",
    description: "Space gray, comes with original box and charger. Great for note-taking in lectures.",
    price: "1250.00",
    type: ListingType.PRODUCT,
    condition: ListingCondition.GOOD,
    categorySlug: "electronics",
    imageUrl: "/uploads/ipad.jpg"
  },
  {
    title: "Hostel Room Study Lamp",
    description: "Adjustable brightness desk lamp. Perfect for late night studying.",
    price: "25.00",
    type: ListingType.PRODUCT,
    condition: ListingCondition.GOOD,
    categorySlug: "dorm-essentials",
    imageUrl: "/uploads/lamp.jpg"
  },
  {
    title: "Python Programming crash course help",
    description: "One-on-one help with your assignments, loops, functions, and debugging support.",
    price: "20.00",
    type: ListingType.SERVICE,
    condition: ListingCondition.NOT_APPLICABLE,
    categorySlug: "tutoring",
    imageUrl: "/uploads/python.jpg"
  },
  {
    title: "IKEA Micke Desk (White)",
    description: "A few minor scratches on the top surface but very sturdy. Perfect for dorm study space.",
    price: "110.00",
    type: ListingType.PRODUCT,
    condition: ListingCondition.GOOD,
    categorySlug: "dorm-essentials",
    imageUrl: "/uploads/desk.jpg"
  },
  {
    title: "Nike Air Max 270 (Size US 9)",
    description: "Worn only a few times. Very comfortable shoes, clean look.",
    price: "150.00",
    type: ListingType.PRODUCT,
    condition: ListingCondition.GOOD,
    categorySlug: "clothing",
    imageUrl: "/uploads/nike.jpg"
  },
  {
    title: "Scientific Calculator Casio fx-570EX",
    description: "Standard model required for all engineering and finance classes. Works perfectly.",
    price: "60.00",
    type: ListingType.PRODUCT,
    condition: ListingCondition.LIKE_NEW,
    categorySlug: "textbooks",
    imageUrl: "/uploads/calculator.jpg"
  },
  {
    title: "Graphic Design for Club Event Posters",
    description: "Need posters or banners for your student club event? High quality designs done quickly.",
    price: "35.00",
    type: ListingType.SERVICE,
    condition: ListingCondition.NOT_APPLICABLE,
    categorySlug: "creative-services",
    imageUrl: "/uploads/design.jpg"
  },
  {
    title: "Ride share to KL Sentral",
    description: "Driving to KL Sentral on Friday afternoon at 4:30 PM. 3 seats available, split petrol cost.",
    price: "15.00",
    type: ListingType.SERVICE,
    condition: ListingCondition.NOT_APPLICABLE,
    categorySlug: "transport",
    imageUrl: "/uploads/ride.jpg"
  },
  {
    title: "Wilson Tennis Racket with cover",
    description: "Good beginner racket. Grip is slightly worn but overall in great shape.",
    price: "80.00",
    type: ListingType.PRODUCT,
    condition: ListingCondition.GOOD,
    categorySlug: "sports",
    imageUrl: "/uploads/racket.jpg"
  }
];

async function main() {
  console.log("Cleaning database...");
  await prisma.transaction.deleteMany();
  await prisma.report.deleteMany();
  await prisma.favorite.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.listingImage.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.emailVerificationToken.deleteMany();
  await prisma.adminActionLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.user.deleteMany();
  await prisma.category.deleteMany();

  console.log("Seeding categories...");
  const dbCategories: Record<string, string> = {};
  for (const [name, slug] of categories) {
    const cat = await prisma.category.create({
      data: { name, slug }
    });
    dbCategories[slug] = cat.id;
  }

  console.log("Seeding admin...");
  const adminPassword = await bcrypt.hash("admin123", 12);
  const admin = await prisma.user.create({
    data: {
      email: "admin",
      name: "Campus Administrator",
      passwordHash: adminPassword,
      role: Role.ADMIN,
      isVerified: true
    }
  });

  await prisma.user.create({
    data: {
      email: "admin@student.newinti.edu.my",
      name: "Campus Administrator (Official)",
      passwordHash: adminPassword,
      role: Role.ADMIN,
      isVerified: true
    }
  });

  console.log("Seeding 10 student accounts...");
  const studentPassword = await bcrypt.hash("12345678", 12);
  const students = [];
  const faculties = ["Faculty of Business", "Faculty of Engineering", "Faculty of IT", "Faculty of Science", "Faculty of Art"];
  const campusAreas = ["Block A Residence", "Block B Residence", "Hostel Block C", "Off-campus Apartment", "Taman Metropolitan"];

  for (let i = 1; i <= 10; i++) {
    const paddedId = String(i).padStart(6, "0");
    const email = `inti_i${paddedId}@student.newinti.edu.my`;
    const name = `Student ${i}`;
    
    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash: studentPassword,
        role: Role.STUDENT,
        isVerified: true,
        faculty: faculties[i % faculties.length],
        campusArea: campusAreas[i % campusAreas.length],
        bio: `Hi, I am Student ${i} from INTI. Let's trade safely!`,
        avatarUrl: `https://images.unsplash.com/photo-${1500000000000 + i * 10000}?w=150&h=150&fit=crop&q=80`
      }
    });
    students.push(user);
  }

  console.log("Seeding 2-3 listings per student with unique Unsplash photos...");
  const allListings = [];
  
  for (let sIdx = 0; sIdx < students.length; sIdx++) {
    const student = students[sIdx];
    const numListings = 2 + (sIdx % 2);

    for (let lIdx = 0; lIdx < numListings; lIdx++) {
      const template = listingTemplates[(sIdx * 2 + lIdx) % listingTemplates.length];
      const isProduct = template.type === ListingType.PRODUCT;
      
      let status: ListingStatus = ListingStatus.ACTIVE;
      if (lIdx === 1 && sIdx % 3 === 0) {
        status = ListingStatus.SOLD;
      } else if (lIdx === 2 && sIdx % 4 === 0) {
        status = ListingStatus.PENDING;
      } else if (sIdx === 8 && lIdx === 0) {
        status = ListingStatus.REJECTED;
      }

      const listing = await prisma.listing.create({
        data: {
          title: `${template.title} (#${sIdx + 1}-${lIdx + 1})`,
          description: template.description,
          price: template.price,
          type: template.type,
          condition: isProduct ? template.condition : ListingCondition.NOT_APPLICABLE,
          status,
          location: "INTI Campus",
          meetupPreference: "INTI Library Level 2",
          sellerId: student.id,
          categoryId: dbCategories[template.categorySlug],
          isNegotiable: sIdx % 2 === 0,
          viewsCount: Math.floor(Math.random() * 80) + 5,
          rejectionReason: status === ListingStatus.REJECTED ? "This type of service is not permitted inside campus dormitories." : null
        }
      });

      // Create beautiful cover image for the listing
      await prisma.listingImage.create({
        data: {
          url: template.imageUrl,
          listingId: listing.id
        }
      });

      allListings.push(listing);
    }
  }

  console.log("Seeding fake purchase history (Transactions)...");
  const soldListings = allListings.filter((l) => l.status === ListingStatus.SOLD);
  
  for (let tIdx = 0; tIdx < soldListings.length; tIdx++) {
    const listing = soldListings[tIdx];
    const sellerIdx = students.findIndex((s) => s.id === listing.sellerId);
    const buyerIdx = (sellerIdx + 2) % students.length;
    const buyer = students[buyerIdx];

    await prisma.transaction.create({
      data: {
        listingId: listing.id,
        buyerId: buyer.id,
        sellerId: listing.sellerId,
        price: listing.price
      }
    });

    const conv = await prisma.conversation.create({
      data: {
        listingId: listing.id,
        buyerId: buyer.id,
        sellerId: listing.sellerId
      }
    });

    await prisma.message.create({
      data: {
        conversationId: conv.id,
        senderId: buyer.id,
        body: "I've sent the payment and we traded at the library lobby. Thank you!"
      }
    });
  }

  console.log("Seeding reports and conversations...");
  const pendingListing = allListings.find(l => l.status === ListingStatus.PENDING);
  if (pendingListing) {
    await prisma.report.create({
      data: {
        reporterId: students[0].id,
        listingId: pendingListing.id,
        reason: "Suspected spam/commercial vendor advertisement",
        details: "Listing contains off-campus store links."
      }
    });
  }

  console.log("Seed finished successfully!");
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
