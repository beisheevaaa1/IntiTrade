import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { 
  Shield, 
  Package, 
  Users, 
  ShoppingBag, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Search, 
  ArrowLeft, 
  Loader2, 
  Lock, 
  Unlock,
  GraduationCap
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { useAuth } from "../../state/AuthContext";
import { api, mediaUrl } from "../../api/client";
import type { User, Listing, Report, Transaction } from "../../types";

export function AdminPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [activeTab, setActiveTab] = useState<"moderation" | "students" | "transactions" | "reports">("moderation");
  
  // Data States
  const [pendingListings, setPendingListings] = useState<Listing[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Rejection Dialog State
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  
  // Filter & Sort States
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedFaculty, setSelectedFaculty] = useState("ALL");
  const [selectedGroup, setSelectedGroup] = useState("ALL"); // e.g. "inti_i000001" to "inti_i000005"
  
  const [listingSearch, setListingSearch] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      // Get all pending listings
      const listingsRes = await api.get("/admin/listings");
      const allListings: Listing[] = listingsRes.data.listings || [];
      setPendingListings(allListings.filter(l => l.status === "PENDING"));

      // Get students
      const usersRes = await api.get("/admin/users");
      const allUsers: User[] = usersRes.data.users || [];
      setStudents(allUsers.filter(u => u.role === "STUDENT"));

      // Get transactions
      const txsRes = await api.get("/admin/transactions");
      setTransactions(txsRes.data.transactions || []);

      // Get reports
      const reportsRes = await api.get("/admin/reports");
      setReports(reportsRes.data.reports || []);
    } catch (err) {
      console.error("Error fetching admin data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Only admins can see this page
    if (localStorage.getItem("isLoggedIn") !== "true") {
      navigate("/login");
      return;
    }
    if (user && user.role !== "ADMIN") {
      navigate("/");
      return;
    }
    fetchData();
  }, [user, navigate]);

  const handleApprove = async (id: string) => {
    setActionLoading(true);
    try {
      await api.patch(`/admin/listings/${id}/moderate`, { status: "ACTIVE" });
      setPendingListings(pendingListings.filter(l => l.id !== id));
      alert("Listing approved successfully!");
    } catch (err) {
      console.error(err);
      alert("Action failed.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingId || !rejectionReason.trim()) return;

    setActionLoading(true);
    try {
      await api.patch(`/admin/listings/${rejectingId}/moderate`, { 
        status: "REJECTED",
        rejectionReason: rejectionReason.trim()
      });
      setPendingListings(pendingListings.filter(l => l.id !== rejectingId));
      setRejectingId(null);
      setRejectionReason("");
      alert("Listing rejected.");
    } catch (err) {
      console.error(err);
      alert("Action failed.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleBlock = async (studentId: string, currentlyBlocked: boolean) => {
    if (!confirm(`Are you sure you want to ${currentlyBlocked ? 'unblock' : 'block'} this student?`)) return;
    try {
      await api.patch(`/admin/users/${studentId}/block`, { isBlocked: !currentlyBlocked });
      setStudents(students.map(s => s.id === studentId ? { ...s, isBlocked: !currentlyBlocked } : s));
      alert(`User status updated.`);
    } catch (err) {
      console.error(err);
      alert("Failed to update user block status.");
    }
  };

  const handleDismissReport = async (reportId: string) => {
    try {
      await api.patch(`/admin/reports/${reportId}`, { status: "DISMISSED" });
      setReports(reports.map(r => r.id === reportId ? { ...r, status: "DISMISSED" as any } : r));
      alert("Report dismissed.");
    } catch (err) {
      console.error(err);
      alert("Action failed.");
    }
  };

  // Group Students by ID Range (e.g., Intake ranges)
  const getIntakeGroup = (email: string) => {
    const match = email.match(/inti_i(\d+)/);
    if (!match) return "Other";
    const num = parseInt(match[1]);
    if (num <= 3) return "Group Alpha (i000001 - i000003)";
    if (num <= 6) return "Group Beta (i000004 - i000006)";
    return "Group Gamma (i000007 - i000010)";
  };

  // Filter students
  const filteredStudents = students.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(studentSearch.toLowerCase()) || 
                          s.email.toLowerCase().includes(studentSearch.toLowerCase());
    const matchesFaculty = selectedFaculty === "ALL" || s.faculty === selectedFaculty;
    
    let matchesGroup = true;
    if (selectedGroup !== "ALL") {
      const group = getIntakeGroup(s.email);
      matchesGroup = group.includes(selectedGroup);
    }

    return matchesSearch && matchesFaculty && matchesGroup;
  });

  const facultiesList = Array.from(new Set(students.map(s => s.faculty).filter(Boolean)));

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-24 bg-gray-50">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="bg-gray-50 flex-grow pb-16">
      <div className="container mx-auto px-4 py-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 text-primary font-bold text-sm mb-1">
              <Shield className="w-4 h-4" /> INTI Campus Moderation
            </div>
            <h1 className="text-3xl font-extrabold text-foreground">Admin Control Panel</h1>
          </div>
          <Button variant="outline" onClick={() => navigate("/")} className="gap-2 bg-white">
            <ArrowLeft className="w-4 h-4" /> Back to Store
          </Button>
        </div>

        {/* Tab Navigation */}
        <div className="flex overflow-x-auto border-b border-border bg-white rounded-xl p-2 gap-2 shadow-sm mb-8">
          <button 
            onClick={() => setActiveTab("moderation")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all whitespace-nowrap ${
              activeTab === "moderation" ? "bg-primary text-white" : "hover:bg-gray-100 text-gray-600"
            }`}
          >
            <Package className="w-4 h-4" /> Moderation Queue
            {pendingListings.length > 0 && (
              <Badge className="bg-red-200 text-red-800 ml-1 font-bold">{pendingListings.length}</Badge>
            )}
          </button>
          
          <button 
            onClick={() => setActiveTab("students")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all whitespace-nowrap ${
              activeTab === "students" ? "bg-primary text-white" : "hover:bg-gray-100 text-gray-600"
            }`}
          >
            <Users className="w-4 h-4" /> Student Management
          </button>
          
          <button 
            onClick={() => setActiveTab("transactions")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all whitespace-nowrap ${
              activeTab === "transactions" ? "bg-primary text-white" : "hover:bg-gray-100 text-gray-600"
            }`}
          >
            <ShoppingBag className="w-4 h-4" /> Transaction Logs
          </button>

          <button 
            onClick={() => setActiveTab("reports")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all whitespace-nowrap ${
              activeTab === "reports" ? "bg-primary text-white" : "hover:bg-gray-100 text-gray-600"
            }`}
          >
            <AlertTriangle className="w-4 h-4" /> User Reports
            {reports.filter(r => r.status === "OPEN").length > 0 && (
              <Badge className="bg-red-200 text-red-800 ml-1 font-bold">
                {reports.filter(r => r.status === "OPEN").length}
              </Badge>
            )}
          </button>
        </div>

        {/* Tab Contents */}
        
        {/* 1. Moderation Queue */}
        {activeTab === "moderation" && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-900">Pending Review ({pendingListings.length})</h2>
            
            {pendingListings.length === 0 ? (
              <div className="bg-white text-center py-12 rounded-2xl border border-border shadow-sm text-muted-foreground">
                No listings require moderation. All caught up!
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-6">
                {pendingListings.map(item => (
                  <Card key={item.id} className="bg-white border-border shadow-sm overflow-hidden flex flex-col h-full">
                    <CardHeader className="bg-gray-50/50 border-b border-border py-4 flex flex-row items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Avatar className="w-8 h-8 border">
                          <AvatarFallback className="text-xs font-bold">US</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-xs font-semibold text-gray-900">{item.seller?.name}</p>
                          <p className="text-[10px] text-muted-foreground">{item.seller?.email}</p>
                        </div>
                      </div>
                      <Badge variant="outline">{item.type}</Badge>
                    </CardHeader>
                    
                    <CardContent className="p-6 flex-1 flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="flex justify-between items-start gap-4">
                          <h3 className="font-bold text-lg text-foreground">{item.title}</h3>
                          <span className="text-primary font-bold text-lg whitespace-nowrap">RM {parseFloat(item.price).toFixed(2)}</span>
                        </div>
                        <p className="text-sm text-gray-600 line-clamp-3">{item.description}</p>
                        <div className="text-xs text-muted-foreground space-y-1">
                          <p><strong>Campus Location:</strong> {item.location}</p>
                          <p><strong>Meetup Preference:</strong> {item.meetupPreference || "Not specified"}</p>
                        </div>
                      </div>

                      <div className="flex gap-3 mt-6 border-t pt-4">
                        <Button 
                          onClick={() => handleApprove(item.id)}
                          disabled={actionLoading}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl h-10 gap-1.5"
                        >
                          <CheckCircle className="w-4 h-4" /> Approve
                        </Button>
                        <Button 
                          onClick={() => setRejectingId(item.id)}
                          disabled={actionLoading}
                          variant="destructive"
                          className="flex-1 font-semibold rounded-xl h-10 gap-1.5"
                        >
                          <XCircle className="w-4 h-4" /> Reject
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Rejection Modal/Form */}
        {rejectingId && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border">
              <h3 className="font-bold text-lg text-foreground mb-2 flex items-center gap-2">
                <AlertTriangle className="text-primary w-5 h-5" /> Reject Listing
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Please provide a clear reason for rejecting this listing. The seller will see this in their dashboard.
              </p>
              
              <form onSubmit={handleRejectSubmit} className="space-y-4">
                <Input 
                  placeholder="e.g. Inappropriate item description, duplication..." 
                  required
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full h-11"
                />
                
                <div className="flex gap-3 justify-end">
                  <Button type="button" variant="ghost" onClick={() => { setRejectingId(null); setRejectionReason(""); }}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="destructive" disabled={actionLoading}>
                    Confirm Reject
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 2. Student Management */}
        {activeTab === "students" && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-white p-4 rounded-xl border shadow-sm">
              <div className="relative flex-1 max-w-md w-full">
                <Input 
                  placeholder="Search students by name or email..." 
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="w-full pl-10"
                />
                <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
              </div>
              
              <div className="flex flex-wrap gap-3">
                <select
                  value={selectedFaculty}
                  onChange={(e) => setSelectedFaculty(e.target.value)}
                  className="h-10 px-3 bg-white border border-border rounded-lg text-sm text-gray-700"
                >
                  <option value="ALL">All Faculties</option>
                  {facultiesList.map(fac => (
                    <option key={fac} value={fac || ""}>{fac}</option>
                  ))}
                </select>

                <select
                  value={selectedGroup}
                  onChange={(e) => setSelectedGroup(e.target.value)}
                  className="h-10 px-3 bg-white border border-border rounded-lg text-sm text-gray-700"
                >
                  <option value="ALL">All Intake Groups</option>
                  <option value="Alpha">Group Alpha (i000001 - i000003)</option>
                  <option value="Beta">Group Beta (i000004 - i000006)</option>
                  <option value="Gamma">Group Gamma (i000007 - i000010)</option>
                </select>
              </div>
            </div>

            <Card className="bg-white border-border shadow-sm overflow-hidden">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-border text-gray-700 font-semibold">
                        <th className="p-4">Student Name</th>
                        <th className="p-4">INTI Email</th>
                        <th className="p-4">Faculty</th>
                        <th className="p-4">Intake Group</th>
                        <th className="p-4">Status</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredStudents.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-muted-foreground">
                            No students match the criteria.
                          </td>
                        </tr>
                      ) : (
                        filteredStudents.map(student => (
                          <tr key={student.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="p-4 font-semibold text-gray-900">{student.name}</td>
                            <td className="p-4 font-mono text-xs">{student.email}</td>
                            <td className="p-4 text-gray-600">{student.faculty || "Not set"}</td>
                            <td className="p-4">
                              <Badge variant="outline" className="bg-gray-50 border-gray-200">
                                {getIntakeGroup(student.email)}
                              </Badge>
                            </td>
                            <td className="p-4">
                              {student.isBlocked ? (
                                <Badge variant="destructive" className="bg-red-100 text-red-800 border-none font-bold">BLOCKED</Badge>
                              ) : (
                                <Badge className="bg-green-100 text-green-800 border-none font-bold">ACTIVE</Badge>
                              )}
                            </td>
                            <td className="p-4 text-right">
                              <Button 
                                onClick={() => handleToggleBlock(student.id, student.isBlocked)}
                                variant={student.isBlocked ? "default" : "outline"}
                                size="sm"
                                className="rounded-lg gap-1"
                              >
                                {student.isBlocked ? (
                                  <>
                                    <Unlock className="w-3.5 h-3.5" /> Unblock
                                  </>
                                ) : (
                                  <>
                                    <Lock className="w-3.5 h-3.5" /> Block
                                  </>
                                )}
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 3. Transaction Logs */}
        {activeTab === "transactions" && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-900">Fake Purchase History (Deals Done)</h2>
            <Card className="bg-white border-border shadow-sm overflow-hidden">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-border text-gray-700 font-semibold">
                        <th className="p-4">Listing Item</th>
                        <th className="p-4">Seller</th>
                        <th className="p-4">Buyer</th>
                        <th className="p-4">Transaction Price</th>
                        <th className="p-4">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {transactions.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-muted-foreground">
                            No deals made yet.
                          </td>
                        </tr>
                      ) : (
                        transactions.map(tx => (
                          <tr key={tx.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="p-4 font-semibold text-gray-900">{tx.listing?.title}</td>
                            <td className="p-4">
                              <p className="font-medium text-gray-900">{tx.seller?.name}</p>
                              <p className="text-[10px] text-muted-foreground font-mono">{tx.seller?.email}</p>
                            </td>
                            <td className="p-4">
                              <p className="font-medium text-gray-900">{tx.buyer?.name}</p>
                              <p className="text-[10px] text-muted-foreground font-mono">{tx.buyer?.email}</p>
                            </td>
                            <td className="p-4 font-bold text-primary">RM {parseFloat(tx.price).toFixed(2)}</td>
                            <td className="p-4 text-muted-foreground">{new Date(tx.createdAt).toLocaleDateString()}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 4. User Reports */}
        {activeTab === "reports" && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-900">Safety Reports ({reports.length})</h2>
            
            {reports.length === 0 ? (
              <div className="bg-white text-center py-12 rounded-2xl border border-border shadow-sm text-muted-foreground">
                No safety reports submitted. Campus is safe!
              </div>
            ) : (
              <div className="space-y-4">
                {reports.map(report => (
                  <Card key={report.id} className="bg-white border-border shadow-sm overflow-hidden">
                    <CardContent className="p-6 space-y-4">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                          <Badge variant="destructive" className="mb-2 bg-red-100 text-red-800 border-none font-bold">
                            {report.status}
                          </Badge>
                          <h3 className="font-bold text-lg text-foreground">
                            Reported Listing: <Link to={`/product/${report.listing?.id}`} className="text-primary hover:underline">{report.listing?.title}</Link>
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            Submitted by: <span className="font-semibold text-gray-700">{report.reporter?.name}</span> ({report.reporter?.email})
                          </p>
                        </div>
                        {report.status === "OPEN" && (
                          <Button 
                            onClick={() => handleDismissReport(report.id)}
                            variant="outline" 
                            size="sm"
                            className="rounded-lg h-9 border-gray-300"
                          >
                            Dismiss Report
                          </Button>
                        )}
                      </div>

                      <div className="bg-gray-50 border p-4 rounded-xl space-y-2">
                        <p className="text-sm"><strong>Reason:</strong> {report.reason}</p>
                        {report.details && (
                          <p className="text-xs text-gray-600"><strong>Additional details:</strong> {report.details}</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
