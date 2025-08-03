import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { getUser, logout } from "@/lib/auth";
import { Download, User, LogOut, Menu } from "lucide-react";

export default function Navbar() {
  const [location] = useLocation();
  const user = getUser();
  
  const handleLogout = () => {
    logout();
    window.location.href = "/";
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/">
            <div className="flex items-center space-x-2 cursor-pointer">
              <Download className="h-8 w-8 text-primary" />
              <span className="text-xl font-bold text-gray-900">TubeAPI</span>
            </div>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-8">
            <Link href="/" className={`text-gray-700 hover:text-primary ${location === "/" ? "text-primary font-medium" : ""}`}>
              Home
            </Link>
            <Link href="/pricing" className={`text-gray-700 hover:text-primary ${location === "/pricing" ? "text-primary font-medium" : ""}`}>
              Pricing
            </Link>
            <Link href="/docs" className={`text-gray-700 hover:text-primary ${location === "/docs" ? "text-primary font-medium" : ""}`}>
              Docs
            </Link>
          </div>

          {/* User Actions */}
          <div className="flex items-center space-x-4">
            {user ? (
              <>
                <Link href="/dashboard">
                  <Button variant="ghost" size="sm" className="flex items-center space-x-2">
                    <User className="h-4 w-4" />
                    <span className="hidden sm:inline">{user.username}</span>
                  </Button>
                </Link>
                <Button variant="ghost" size="sm" onClick={handleLogout} className="flex items-center space-x-2">
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Logout</span>
                </Button>
              </>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="sm">Login</Button>
                </Link>
                <Link href="/register">
                  <Button size="sm">Sign Up</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}