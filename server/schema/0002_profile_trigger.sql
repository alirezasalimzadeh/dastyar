-- ============================================================================
-- دستیار مشاور — تریگر ثبت‌نام (0002)
-- اجرا می‌شود: بعد از اینکه GoTrue جدول auth.users را ساخت (کانتینر یک‌باره)
--
-- وقتی حساب جدید در auth.users ساخته می‌شود:
--   ۱) پروفایل (consultant) با اطلاعات فرم ثبت‌نام ساخته می‌شود
--      (اطلاعات از raw_user_meta_data می‌آید — همان options.data فرم)
--   ۲) دیکشنری ۱۶ تگ پیش‌فرض برای آن کاربر seed می‌شود
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  meta jsonb NOT NULL DEFAULT '{}'::jsonb;
BEGIN
  meta := coalesce(NEW.raw_user_meta_data, '{}'::jsonb);

  INSERT INTO public.profiles (
    id, first_name, last_name, mobile, email,
    role, account_status, created_at, updated_at
  ) VALUES (
    NEW.id,
    meta->>'first_name',
    meta->>'last_name',
    meta->>'mobile',
    NEW.email,
    'consultant',
    'active',
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE
    SET
      first_name = coalesce(EXCLUDED.first_name, public.profiles.first_name),
      last_name = coalesce(EXCLUDED.last_name, public.profiles.last_name),
      mobile = coalesce(EXCLUDED.mobile, public.profiles.mobile),
      email = coalesce(EXCLUDED.email, public.profiles.email),
      updated_at = now();

  INSERT INTO public.tags (user_id, name, color) VALUES
    (NEW.id, 'سرمایه‌گذار', 'green'),
    (NEW.id, 'فوری', 'red'),
    (NEW.id, 'تخلیه فوری', 'red'),
    (NEW.id, 'مالک سخت‌گیر', 'orange'),
    (NEW.id, 'مشتری جدی', 'green'),
    (NEW.id, 'مناسب سرمایه‌گذاری', 'blue'),
    (NEW.id, 'نقدینگی بالا', 'green'),
    (NEW.id, 'تخفیف', 'purple'),
    (NEW.id, 'تبدیل‌پذیر', 'blue'),
    (NEW.id, 'داغ', 'red'),
    (NEW.id, 'سرد', 'blue'),
    (NEW.id, 'گرم', 'orange'),
    (NEW.id, 'VIP', 'gold'),
    (NEW.id, 'منطقه پررونق', 'green'),
    (NEW.id, 'نوسازی', 'teal'),
    (NEW.id, 'قابل بازسازی', 'orange')
  ON CONFLICT (user_id, name) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

COMMENT ON FUNCTION public.handle_new_user() IS
  'ساخت پروفایل + تگ‌های پیش‌فرض برای هر حساب جدید (اجرا به‌صورت خودکار هنگام ثبت‌نام)';
