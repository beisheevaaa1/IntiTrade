import { PrismaClient, ListingCondition, ListingStatus, ListingType, Role, SellerType, TransactionStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

if (process.env.NODE_ENV === "production") {
  throw new Error("Production database seeding is disabled");
}
if (process.env.ALLOW_DESTRUCTIVE_SEED !== "true") {
  throw new Error("Set ALLOW_DESTRUCTIVE_SEED=true only for a disposable development database");
}

function requiredSeedValue(name: "SEED_ADMIN_EMAIL" | "SEED_ADMIN_PASSWORD" | "SEED_STUDENT_PASSWORD") {
  const value = process.env[name]?.trim();
  if (value) return value;
  if (name === "SEED_ADMIN_EMAIL") return "admin@newinti.edu.my";
  throw new Error(`${name} is required for development seeding`);
}

const seedAdminEmail = requiredSeedValue("SEED_ADMIN_EMAIL").toLowerCase();
const seedAdminPassword = requiredSeedValue("SEED_ADMIN_PASSWORD");
const seedStudentPassword = requiredSeedValue("SEED_STUDENT_PASSWORD");
if (!seedAdminEmail.includes("@") || Buffer.byteLength(seedAdminPassword, "utf8") < 12 || Buffer.byteLength(seedAdminPassword, "utf8") > 72) {
  throw new Error("Use a valid SEED_ADMIN_EMAIL and a unique 12-72 byte SEED_ADMIN_PASSWORD");
}
if (Buffer.byteLength(seedStudentPassword, "utf8") < 12 || Buffer.byteLength(seedStudentPassword, "utf8") > 72) {
  throw new Error("SEED_STUDENT_PASSWORD must contain 12-72 bytes");
}

const prisma = new PrismaClient();

const categories = [
  ["Textbooks", "textbooks"],
  ["Electronics", "electronics"],
  ["Dorm essentials", "dorm-essentials"],
  ["Tutoring", "tutoring"],
  ["Courses", "courses"],
  ["Creative services", "creative-services"],
  ["Transport", "transport"],
  ["Sports", "sports"],
  ["Clothing", "clothing"]
] as const;

// Create lists of titles, descriptions and high-quality Unsplash image URLs for listings
const listingTemplates = [
  {
    title: "Calculus Early Transcendentals 8th Edition",
    description: "# Mint Condition Calculus Textbook\nUsed for the first semester math course.\n\n## Features:\n- **No marks** or highlights inside.\n- Includes clean original covers.\n- Essential for `MAT101` and `MAT102`.\n\n### Course Support:\n```math\nCalculus I, II & III\n```",
    price: "85.00",
    type: ListingType.PRODUCT,
    condition: ListingCondition.LIKE_NEW,
    categorySlug: "textbooks",
    imageUrls: [
      "/uploads/calculus.jpg",
      "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&q=80",
      "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=600&q=80"
    ]
  },
  {
    title: "iPad Air 4th Generation 64GB",
    description: "Space gray, comes with original box and charger. Great for note-taking in lectures.",
    price: "1250.00",
    type: ListingType.PRODUCT,
    condition: ListingCondition.GOOD,
    categorySlug: "electronics",
    imageUrls: [
      "/uploads/ipad.jpg",
      "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=600&q=80",
      "https://images.unsplash.com/photo-1589739900243-4b52cd9b104e?w=600&q=80"
    ]
  },
  {
    title: "Hostel Room Study Lamp",
    description: "Adjustable brightness desk lamp. Perfect for late night studying.",
    price: "25.00",
    type: ListingType.PRODUCT,
    condition: ListingCondition.GOOD,
    categorySlug: "dorm-essentials",
    imageUrls: [
      "/uploads/lamp.jpg",
      "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=600&q=80",
      "https://images.unsplash.com/photo-1534073828943-f801091bb18c?w=600&q=80"
    ]
  },
  {
    title: "Python Programming crash course help",
    description: "# Python Tutoring & Homework Help\nOne-on-one help with your assignments, loops, functions, and debugging support.\n\n## Topics Covered:\n- **Object Oriented Programming** (classes, inheritance)\n- Data Structures (`list`, `dict`, `set`)\n- File Handling & Automation\n\n### Example Code Snippet:\n```python\ndef greet_student(name):\n    print(f\"Welcome to INTI Trade, {name}!\")\n```",
    price: "20.00",
    type: ListingType.SERVICE,
    condition: ListingCondition.NOT_APPLICABLE,
    categorySlug: "tutoring",
    imageUrls: [
      "/uploads/python.jpg",
      "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=600&q=80",
      "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?w=600&q=80"
    ]
  },
  {
    title: "IKEA Micke Desk (White)",
    description: "A few minor scratches on the top surface but very sturdy. Perfect for dorm study space.",
    price: "110.00",
    type: ListingType.PRODUCT,
    condition: ListingCondition.GOOD,
    categorySlug: "dorm-essentials",
    imageUrls: [
      "/uploads/desk.jpg",
      "https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=600&q=80",
      "https://images.unsplash.com/photo-1486946255434-2466348c2166?w=600&q=80"
    ]
  },
  {
    title: "Nike Air Max 270 (Size US 9)",
    description: "Worn only a few times. Very comfortable shoes, clean look.",
    price: "150.00",
    type: ListingType.PRODUCT,
    condition: ListingCondition.GOOD,
    categorySlug: "clothing",
    imageUrls: [
      "/uploads/nike.jpg",
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80",
      "https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=600&q=80"
    ]
  },
  {
    title: "Scientific Calculator Casio fx-570EX",
    description: "Standard model required for all engineering and finance classes. Works perfectly.",
    price: "60.00",
    type: ListingType.PRODUCT,
    condition: ListingCondition.LIKE_NEW,
    categorySlug: "textbooks",
    imageUrls: [
      "/uploads/calculator.jpg",
      "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=600&q=80",
      "https://images.unsplash.com/photo-1587145820266-a5951ee6f620?w=600&q=80"
    ]
  },
  {
    title: "Graphic Design for Club Event Posters",
    description: "Need posters or banners for your student club event? High quality designs done quickly.",
    price: "35.00",
    type: ListingType.SERVICE,
    condition: ListingCondition.NOT_APPLICABLE,
    categorySlug: "creative-services",
    imageUrls: [
      "/uploads/design.jpg",
      "https://images.unsplash.com/photo-1626785774573-4b799315345d?w=600&q=80",
      "https://images.unsplash.com/photo-1561070791-26c113006238?w=600&q=80"
    ]
  },
  {
    title: "Ride share to KL Sentral",
    description: "Driving to KL Sentral on Friday afternoon at 4:30 PM. 3 seats available, split petrol cost.",
    price: "15.00",
    type: ListingType.SERVICE,
    condition: ListingCondition.NOT_APPLICABLE,
    categorySlug: "transport",
    imageUrls: [
      "/uploads/ride.jpg",
      "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=600&q=80",
      "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=600&q=80"
    ]
  },
  {
    title: "Wilson Tennis Racket with cover",
    description: "Good beginner racket. Grip is slightly worn but overall in great shape.",
    price: "80.00",
    type: ListingType.PRODUCT,
    condition: ListingCondition.GOOD,
    categorySlug: "sports",
    imageUrls: [
      "/uploads/racket.jpg",
      "https://images.unsplash.com/photo-1622279457486-62dcc4a4aba5?w=600&q=80",
      "https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=600&q=80"
    ]
  }
];

function templateSellerType(index: number) {
  return index % 3 === 0 ? SellerType.SERVICE_PROVIDER : SellerType.CASUAL;
}

async function main() {
  console.log("Cleaning database...");
  await prisma.review.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.report.deleteMany();
  await prisma.favorite.deleteMany();
  await prisma.message.deleteMany();
  await prisma.supportTicketMessage.deleteMany();
  await prisma.supportTicket.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.listingImage.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.emailVerificationToken.deleteMany();
  await prisma.adminActionLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.userBlock.deleteMany();
  await prisma.announcement.deleteMany();
  await prisma.user.deleteMany();
  await prisma.meetupPoint.deleteMany();
  await prisma.category.deleteMany();

  console.log("Seeding categories...");
  const dbCategories: Record<string, string> = {};
  for (const [name, slug] of categories) {
    const cat = await prisma.category.create({
      data: { name, slug }
    });
    dbCategories[slug] = cat.id;
  }

  const meetupPoints = await Promise.all([
    prisma.meetupPoint.create({ data: { name: "Main Library Entrance", description: "Covered, staffed entrance with CCTV", campusArea: "Main Campus" } }),
    prisma.meetupPoint.create({ data: { name: "Student Centre Help Desk", description: "Busy public lobby beside the help desk", campusArea: "Student Centre" } }),
    prisma.meetupPoint.create({ data: { name: "Cafeteria Main Entrance", description: "Daytime meetup point near campus security", campusArea: "Cafeteria" } })
  ]);

  console.log("Seeding admin...");
  const adminPassword = await bcrypt.hash(seedAdminPassword, 12);
  await prisma.user.create({
    data: {
      email: seedAdminEmail,
      name: "INTI Campus Administrator & Staff",
      passwordHash: adminPassword,
      role: Role.ADMIN,
      faculty: "INTI Staff • Campus Administration",
      isVerified: true
    }
  });

  console.log("Seeding 10 student accounts with academic profiles...");
  const studentPassword = await bcrypt.hash(seedStudentPassword, 12);
  const students = [];
  const campusAreas = ["Block A Residence", "Block B Residence", "Hostel Block C", "Off-campus Apartment", "Taman Metropolitan"];

  const mockStudents = [
    { name: "Daniel Tan", faculty: "Faculty of IT", email: "inti_i000001@student.newinti.edu.my", gpa: 3.85, showAcademicProfile: true, avatarUrl: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&h=150&fit=crop&q=80" },
    { name: "Sarah Lim", faculty: "Faculty of Business", email: "inti_i000002@student.newinti.edu.my", gpa: 3.92, showAcademicProfile: true, avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&q=80" },
    { name: "Adil Khan", faculty: "Faculty of Engineering", email: "inti_i000003@student.newinti.edu.my", gpa: 3.65, showAcademicProfile: true, avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&q=80" },
    { name: "Priya Sharma", faculty: "Faculty of Science", email: "inti_i000004@student.newinti.edu.my", gpa: 3.78, showAcademicProfile: true, avatarUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&q=80" },
    { name: "Marcus Wong", faculty: "Faculty of IT", email: "inti_i000005@student.newinti.edu.my", gpa: 3.42, showAcademicProfile: false, avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&q=80" },
    { name: "Aisha Yusuf", faculty: "Faculty of Art", email: "inti_i000006@student.newinti.edu.my", gpa: 3.58, showAcademicProfile: true, avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop&q=80" },
    { name: "Kevin Matthews", faculty: "Faculty of Engineering", email: "inti_i000007@student.newinti.edu.my", gpa: 3.25, showAcademicProfile: false, avatarUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&h=150&fit=crop&q=80" },
    { name: "Chloe Dupont", faculty: "Faculty of Art", email: "inti_i000008@student.newinti.edu.my", gpa: 3.71, showAcademicProfile: true, avatarUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&h=150&fit=crop&q=80" },
    { name: "Ryu Tanaka", faculty: "Faculty of Science", email: "inti_i000009@student.newinti.edu.my", gpa: 3.90, showAcademicProfile: true, avatarUrl: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&h=150&fit=crop&q=80" },
    { name: "Emily Clark", faculty: "Faculty of Business", email: "inti_i000010@student.newinti.edu.my", gpa: 3.49, showAcademicProfile: false, avatarUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&q=80" }
  ];

  const gradesMap: Record<string, Array<{ course: string; grade: string }>> = {
    "Faculty of IT": [
      { course: "Data Structures & Algorithms", grade: "A" },
      { course: "Database Management Systems", grade: "A-" },
      { course: "Object Oriented Programming", grade: "A" },
      { course: "Calculus & Linear Algebra", grade: "B+" }
    ],
    "Faculty of Business": [
      { course: "Introduction to Economics", grade: "A" },
      { course: "Principles of Marketing", grade: "A" },
      { course: "Business Finance", grade: "B+" },
      { course: "Organizational Behaviour", grade: "A-" }
    ],
    "Faculty of Engineering": [
      { course: "Calculus I & II", grade: "A" },
      { course: "Engineering Physics", grade: "A-" },
      { course: "Circuit Theory", grade: "B+" },
      { course: "Digital Electronics", grade: "A" }
    ],
    "Faculty of Science": [
      { course: "Organic Chemistry", grade: "A" },
      { course: "Statistical Methods", grade: "A-" },
      { course: "General Biology", grade: "B+" },
      { course: "Scientific Writing", grade: "A" }
    ],
    "Faculty of Art": [
      { course: "Digital Illustration", grade: "A" },
      { course: "History of Modern Art", grade: "A" },
      { course: "Color Theory & Design", grade: "B+" },
      { course: "Portfolio Development", grade: "A-" }
    ]
  };

  for (let i = 0; i < mockStudents.length; i++) {
    const mock = mockStudents[i];
    const userGrades = gradesMap[mock.faculty] || gradesMap["Faculty of IT"];
    const projectsText = `- Course Grade Tracker: Web dashboard resolving student GPA and course completion timelines.\n- Campus Event Planner: A collaborative calendar system for managing student club schedules.`;
    const resumeText = `Dedicated ${mock.faculty} student at INTI University. Experienced in academic projects and team leadership. Eager to tutor and share materials with fellow students.`;

    const user = await prisma.user.create({
      data: {
        email: mock.email,
        name: mock.name,
        passwordHash: studentPassword,
        role: Role.STUDENT,
        isVerified: true,
        faculty: mock.faculty,
        campusArea: campusAreas[i % campusAreas.length],
        bio: `Hi, I am ${mock.name} from INTI. Let's trade safely!`,
        avatarUrl: mock.avatarUrl,
        sellerType: i % 5 === 0 ? SellerType.SHOP : templateSellerType(i),
        gpa: mock.gpa,
        showAcademicProfile: mock.showAcademicProfile,
        academicGrades: JSON.stringify(userGrades),
        projects: projectsText,
        resume: resumeText,
        academicTipShown: true
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
          meetupPointId: meetupPoints[sIdx % meetupPoints.length].id,
          sellerId: student.id,
          categoryId: dbCategories[template.categorySlug],
          isNegotiable: sIdx % 2 === 0,
          viewsCount: Math.floor(Math.random() * 80) + 15,
          interestCount: Math.floor(Math.random() * 8) + 1,
          rejectionReason: status === ListingStatus.REJECTED ? "This type of service is not permitted inside campus dormitories." : null
        }
      });

      // Create multiple high-quality images for the listing
      for (const imgUrl of template.imageUrls) {
        await prisma.listingImage.create({
          data: {
            url: imgUrl,
            listingId: listing.id
          }
        });
      }

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

    const transaction = await prisma.transaction.create({
      data: {
        listingId: listing.id,
        buyerId: buyer.id,
        sellerId: listing.sellerId,
        price: listing.price,
        status: TransactionStatus.COMPLETED,
        completedAt: new Date()
      }
    });

    await prisma.review.create({
      data: { transactionId: transaction.id, reviewerId: buyer.id, revieweeId: listing.sellerId, rating: 4 + (tIdx % 2), comment: "Smooth campus meetup and the item matched the description." }
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
    console.error(JSON.stringify({ level: "error", event: "development_seed_failed", errorType: error instanceof Error ? error.name : "UnknownError" }));
    await prisma.$disconnect();
    process.exit(1);
  });
