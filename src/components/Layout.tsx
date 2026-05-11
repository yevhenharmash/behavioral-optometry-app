import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Calendar, Users, Dumbbell, UserCheck, Settings, LogOut, Eye, Menu, X, Sun, Moon } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { useTheme } from '@/lib/theme'

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Today', end: true },
  { to: '/calendar', icon: Calendar, label: 'Calendar', end: false },
  { to: '/patients', icon: Users, label: 'Patients', end: false },
  { to: '/activities', icon: Dumbbell, label: 'Activities', end: false },
  { to: '/referrers', icon: UserCheck, label: 'Referrers', end: false },
  { to: '/settings', icon: Settings, label: 'Settings', end: false },
]

export function Layout() {
  const { user, signOut } = useAuth()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  const closeSidebar = () => setMobileSidebarOpen(false)

  return (
    <div className="flex h-screen bg-background text-foreground">
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
          onClick={closeSidebar}
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-30 w-56 flex-none border-r border-border flex flex-col bg-sidebar
          transition-transform duration-200
          ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          md:relative md:translate-x-0
        `}
      >
        <div className="px-5 py-5 border-b border-border flex items-center justify-between">
          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => { navigate('/'); closeSidebar() }}
          >
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Eye className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-sidebar-foreground text-sm tracking-tight">
              BehaveOpt
            </span>
          </div>
          <button
            onClick={closeSidebar}
            className="p-1.5 rounded text-sidebar-foreground/40 hover:text-sidebar-foreground transition-colors md:hidden"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {NAV_ITEMS.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={closeSidebar}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary/15 text-primary'
                    : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent'
                }`
              }
            >
              <Icon className="w-4 h-4 flex-none" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-border space-y-2">
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
          {user && (
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          )}
          <button
            onClick={signOut}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-background flex flex-col min-w-0">
        <div className="flex items-center gap-3 px-4 py-4 border-b border-border md:hidden">
          <button
            onClick={() => setMobileSidebarOpen((v) => !v)}
            className="p-2 rounded text-muted-foreground hover:text-foreground transition-colors"
          >
            {mobileSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <span
            className="flex-1 font-semibold text-base tracking-tight cursor-pointer"
            onClick={() => { navigate('/'); closeSidebar() }}
          >
            BehaveOpt
          </span>
        </div>
        <Outlet />
      </main>
    </div>
  )
}
