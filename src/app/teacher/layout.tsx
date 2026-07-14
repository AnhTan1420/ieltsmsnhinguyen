// src/app/teacher/layout.tsx
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/server'

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createSupabaseServerClient()

  // ✅ Dùng getUser() — không bị JWTIssuedAtFuture
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login')
  }

  // Double-check role ở server level
  const role = user.user_metadata?.role ?? user.app_metadata?.role
  if (role !== 'teacher' && role !== 'admin') {
    redirect('/unauthorized')
  }

  return (
    <div className="teacher-workspace">
      {/* Teacher Workspace layout */}
      {children}
    </div>
  )
}
