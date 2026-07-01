import React from "react";
import { Link } from "react-router";
import { Plus, Search, MapPin, Clock, Filter, ArrowRight } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";

const mockWantAds = [
  {
    id: "1",
    title: "Lab Coat (Size M)",
    description: "Need a standard white lab coat for chemistry practicals. Must be in good condition without major stains. Needed by next week.",
    budget: 30,
    category: "Academic Materials",
    date: "2 hours ago",
    user: { initials: "JD", name: "John Doe", role: "Student" },
    matches: 0
  },
  {
    id: "2",
    title: "Graphing Calculator (TI-84 Plus)",
    description: "Looking for a working Texas Instruments TI-84 Plus CE. Battery should be in good condition. Willing to negotiate slightly based on condition.",
    budget: 200,
    category: "Academic Materials",
    date: "1 day ago",
    user: { initials: "SL", name: "Sarah L.", role: "Student" },
    matches: 2
  },
  {
    id: "3",
    title: "Mini Fridge for Dorm",
    description: "Looking for a small refrigerator for my dorm room. Needs to be clean and working properly. I can pick it up from your block.",
    budget: 150,
    category: "Room Essentials",
    date: "2 days ago",
    user: { initials: "AK", name: "Ahmad K.", role: "Student" },
    matches: 1
  },
  {
    id: "4",
    title: "Computer Networks 5th Edition",
    description: "Textbook by Tanenbaum. Need it for the current semester. Highlighting inside is fine as long as pages aren't missing.",
    budget: 60,
    category: "Textbooks",
    date: "3 days ago",
    user: { initials: "WT", name: "Wei T.", role: "Student" },
    matches: 0
  },
  {
    id: "5",
    title: "Monitor Stand / Riser",
    description: "Looking for a basic wooden or metal monitor stand to improve ergonomics on my desk.",
    budget: 25,
    category: "Furniture",
    date: "4 days ago",
    user: { initials: "ML", name: "Mei Ling", role: "Staff" },
    matches: 0
  },
  {
    id: "6",
    title: "Badminton Racket",
    description: "Need a decent intermediate level racket. Yonex or Li-Ning preferred. Strings should be intact.",
    budget: 80,
    category: "Sports & Hobbies",
    date: "5 days ago",
    user: { initials: "RV", name: "Raj V.", role: "Student" },
    matches: 3
  }
];

export function WantAds() {
  return (
    <div className="flex flex-col min-h-screen bg-gray-50/50">
      {/* Header section */}
      <div className="bg-white border-b border-border py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">Want Ads</h1>
              <p className="text-muted-foreground">Help fellow INTI members find what they need, or post your own request.</p>
            </div>
            <Link to="/create-want-ad">
              <Button className="gap-2">
                <Plus className="h-4 w-4" /> Post a Request
              </Button>
            </Link>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 mt-8">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search requests..." className="pl-9 bg-gray-50" />
            </div>
            <Button variant="outline" className="gap-2 sm:w-auto w-full">
              <Filter className="h-4 w-4" /> Filters
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 flex-1">
        <div className="flex justify-between items-center mb-6">
          <p className="text-sm font-medium text-muted-foreground">{mockWantAds.length} Active Requests</p>
          <select className="text-sm border-0 bg-transparent font-medium text-foreground cursor-pointer focus:ring-0">
            <option>Newest First</option>
            <option>Highest Budget</option>
            <option>Lowest Budget</option>
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mockWantAds.map((ad) => (
            <div key={ad.id} className="bg-white rounded-xl border border-border overflow-hidden hover:shadow-md transition-shadow flex flex-col h-full">
              <div className="p-5 flex-1 flex flex-col">
                <div className="flex justify-between items-start gap-4 mb-3">
                  <h3 className="font-bold text-lg text-foreground line-clamp-2 leading-tight">{ad.title}</h3>
                  <div className="bg-red-50 text-primary font-bold px-3 py-1 rounded-full whitespace-nowrap text-sm">
                    Max RM {ad.budget}
                  </div>
                </div>
                
                <Badge variant="secondary" className="w-fit mb-3 bg-gray-100 text-gray-700 hover:bg-gray-100">{ad.category}</Badge>
                
                <p className="text-sm text-muted-foreground line-clamp-3 mb-4 flex-1">
                  {ad.description}
                </p>
                
                <div className="flex items-center gap-2 mt-auto text-xs text-gray-500 mb-4">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Posted {ad.date}</span>
                  <span className="mx-1">•</span>
                  <span>{ad.matches} matches</span>
                </div>
                
                <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
                    {ad.user.initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 leading-none mb-1">{ad.user.name}</p>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">{ad.user.role}</p>
                  </div>
                </div>
              </div>
              
              <div className="border-t border-border grid grid-cols-2 bg-gray-50/50">
                <Button variant="ghost" className="rounded-none border-r border-border hover:bg-red-50 hover:text-primary text-gray-600 font-medium h-12">
                  I Have This
                </Button>
                <Button variant="ghost" className="rounded-none hover:bg-gray-100 text-gray-600 font-medium h-12 gap-2">
                  Message
                </Button>
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-12 text-center">
          <Button variant="outline" className="rounded-full px-8">Load More Requests</Button>
        </div>
      </div>
    </div>
  );
}
