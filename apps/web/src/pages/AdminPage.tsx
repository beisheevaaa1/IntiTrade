import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../state/AuthContext";
import type { Listing, ListingStatus, Report, ReportStatus } from "../types";

type Overview = {
  pendingListings: number;
  openReports: number;
  users: number;
  activeListings: number;
};

export function AdminPage() {
  const { user } = useAuth();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [reports, setReports] = useState<Report[]>([]);

  async function load() {
    const [overviewResponse, listingResponse, reportResponse] = await Promise.all([
      api.get("/admin/overview"),
      api.get("/admin/listings"),
      api.get("/admin/reports")
    ]);
    setOverview(overviewResponse.data);
    setListings(listingResponse.data.listings);
    setReports(reportResponse.data.reports);
  }

  useEffect(() => {
    if (user?.role === "ADMIN") load();
  }, [user?.role]);

  if (user?.role !== "ADMIN") return <Navigate to="/" replace />;

  async function listingStatus(id: string, status: ListingStatus) {
    await api.patch(`/admin/listings/${id}/status`, { status });
    load();
  }

  async function reportStatus(id: string, status: ReportStatus) {
    await api.patch(`/admin/reports/${id}`, { status });
    load();
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Admin dashboard</h1>
      <section className="grid gap-3 sm:grid-cols-4">
        {overview && Object.entries(overview).map(([key, value]) => (
          <div className="metric panel" key={key}><strong>{value}</strong><span>{key.replace(/([A-Z])/g, " $1")}</span></div>
        ))}
      </section>
      <section className="panel overflow-hidden">
        <div className="border-b border-line p-4 font-semibold">Listing moderation</div>
        <div className="divide-y divide-line">
          {listings.map((listing) => (
            <div key={listing.id} className="grid gap-3 p-4 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <div className="font-semibold">{listing.title}</div>
                <div className="text-sm text-ink/60">{listing.seller.name} · {listing.status.toLowerCase()}</div>
              </div>
              <div className="flex gap-2">
                <button className="button-secondary" onClick={() => listingStatus(listing.id, "ACTIVE")}>Approve</button>
                <button className="button-secondary" onClick={() => listingStatus(listing.id, "REJECTED")}>Reject</button>
                <button className="button-secondary" onClick={() => listingStatus(listing.id, "ARCHIVED")}>Archive</button>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="panel overflow-hidden">
        <div className="border-b border-line p-4 font-semibold">Reports</div>
        <div className="divide-y divide-line">
          {reports.map((report) => (
            <div key={report.id} className="grid gap-3 p-4 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <div className="font-semibold">{report.reason}</div>
                <div className="text-sm text-ink/60">{report.listing.title} · {report.reporter.email} · {report.status.toLowerCase()}</div>
              </div>
              <div className="flex gap-2">
                <button className="button-secondary" onClick={() => reportStatus(report.id, "REVIEWED")}>Review</button>
                <button className="button-secondary" onClick={() => reportStatus(report.id, "ACTIONED")}>Actioned</button>
                <button className="button-secondary" onClick={() => reportStatus(report.id, "DISMISSED")}>Dismiss</button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
