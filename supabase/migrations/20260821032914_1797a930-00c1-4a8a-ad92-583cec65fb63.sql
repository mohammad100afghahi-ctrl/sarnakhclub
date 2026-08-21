
-- ROLES
CREATE TYPE public.app_role AS ENUM ('admin','user');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL,
  avatar_url text,
  is_banned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "profiles_read" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_self" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(),'admin')) WITH CHECK (true);
CREATE POLICY "roles_read_self" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- GAMES
CREATE TABLE public.games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  creator_studio text,
  release_year int,
  platforms text[] NOT NULL DEFAULT '{}',
  genres text[] NOT NULL DEFAULT '{}',
  min_players int,
  max_players int,
  age_rating text,
  duration_minutes int,
  poster_url text,
  status text NOT NULL DEFAULT 'active',
  featured boolean NOT NULL DEFAULT false,
  views int NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.games TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.games TO authenticated;
GRANT ALL ON public.games TO service_role;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "games_read" ON public.games FOR SELECT USING (status = 'active' OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "games_admin_write" ON public.games FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tags TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tags TO authenticated;
GRANT ALL ON public.tags TO service_role;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tags_read" ON public.tags FOR SELECT USING (status='approved' OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "tags_insert" ON public.tags FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "tags_admin" ON public.tags FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.game_tags (
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_by uuid,
  PRIMARY KEY (game_id, tag_id)
);
GRANT SELECT ON public.game_tags TO anon;
GRANT SELECT, INSERT, DELETE ON public.game_tags TO authenticated;
GRANT ALL ON public.game_tags TO service_role;
ALTER TABLE public.game_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "game_tags_read" ON public.game_tags FOR SELECT USING (true);
CREATE POLICY "game_tags_insert" ON public.game_tags FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "game_tags_admin_del" ON public.game_tags FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- RATINGS
CREATE TABLE public.ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  score int NOT NULL CHECK (score BETWEEN 1 AND 10),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, game_id)
);
GRANT SELECT ON public.ratings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ratings TO authenticated;
GRANT ALL ON public.ratings TO service_role;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ratings_read" ON public.ratings FOR SELECT USING (true);
CREATE POLICY "ratings_own" ON public.ratings FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- REVIEWS
CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  text text NOT NULL,
  is_spoiler boolean NOT NULL DEFAULT false,
  helpful_count int NOT NULL DEFAULT 0,
  unhelpful_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews_read" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "reviews_own" ON public.reviews FOR ALL TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin')) WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.review_votes (
  review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vote_type text NOT NULL CHECK (vote_type IN ('helpful','unhelpful')),
  PRIMARY KEY (review_id, user_id)
);
GRANT SELECT ON public.review_votes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.review_votes TO authenticated;
GRANT ALL ON public.review_votes TO service_role;
ALTER TABLE public.review_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rv_read" ON public.review_votes FOR SELECT USING (true);
CREATE POLICY "rv_own" ON public.review_votes FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.sync_review_votes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rid uuid;
BEGIN
  rid := COALESCE(NEW.review_id, OLD.review_id);
  UPDATE public.reviews SET
    helpful_count = (SELECT count(*) FROM public.review_votes WHERE review_id = rid AND vote_type='helpful'),
    unhelpful_count = (SELECT count(*) FROM public.review_votes WHERE review_id = rid AND vote_type='unhelpful')
  WHERE id = rid;
  RETURN NULL;
END; $$;
CREATE TRIGGER trg_review_votes AFTER INSERT OR UPDATE OR DELETE ON public.review_votes
FOR EACH ROW EXECUTE FUNCTION public.sync_review_votes();

-- WISHLIST
CREATE TABLE public.wishlist (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, game_id)
);
GRANT SELECT, INSERT, DELETE ON public.wishlist TO authenticated;
GRANT ALL ON public.wishlist TO service_role;
ALTER TABLE public.wishlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wishlist_own" ON public.wishlist FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- SUGGESTIONS
CREATE TABLE public.game_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  creator_studio text,
  release_year int,
  platforms text[] NOT NULL DEFAULT '{}',
  source_url text,
  poster_url text,
  status text NOT NULL DEFAULT 'pending',
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_suggestions TO authenticated;
GRANT ALL ON public.game_suggestions TO service_role;
ALTER TABLE public.game_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sugg_own" ON public.game_suggestions FOR ALL TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin')) WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- REPORTS
CREATE TABLE public.review_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (review_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.review_reports TO authenticated;
GRANT ALL ON public.review_reports TO service_role;
ALTER TABLE public.review_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports_insert" ON public.review_reports FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "reports_admin" ON public.review_reports FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- SETTINGS
CREATE TABLE public.site_settings (
  key text PRIMARY KEY,
  value numeric NOT NULL
);
GRANT SELECT ON public.site_settings TO anon;
GRANT SELECT, INSERT, UPDATE ON public.site_settings TO authenticated;
GRANT ALL ON public.site_settings TO service_role;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_read" ON public.site_settings FOR SELECT USING (true);
CREATE POLICY "settings_admin" ON public.site_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
INSERT INTO public.site_settings(key, value) VALUES ('min_votes', 25);

-- RANKING VIEW (bayesian weighted rating)
CREATE VIEW public.game_rankings
WITH (security_invoker = true) AS
WITH agg AS (
  SELECT g.id, COALESCE(avg(r.score),0)::numeric AS raw_avg, count(r.id)::int AS votes
  FROM public.games g LEFT JOIN public.ratings r ON r.game_id = g.id
  WHERE g.status = 'active'
  GROUP BY g.id
), consts AS (
  SELECT (SELECT COALESCE(avg(score), 7) FROM public.ratings) AS c,
         (SELECT value FROM public.site_settings WHERE key='min_votes') AS m
)
SELECT g.*, a.raw_avg, a.votes, consts.m AS min_votes,
  ROUND((a.votes / (a.votes + consts.m)::numeric) * a.raw_avg
      + (consts.m / (a.votes + consts.m)::numeric) * consts.c, 2) AS weighted_score
FROM public.games g
JOIN agg a ON a.id = g.id
CROSS JOIN consts;
GRANT SELECT ON public.game_rankings TO anon, authenticated, service_role;

-- SEED
INSERT INTO public.games (title, description, creator_studio, release_year, platforms, genres, min_players, max_players, age_rating, duration_minutes, poster_url, featured, views) VALUES
('مافیا','بازی رومیزی نقش‌مخفی که در آن شهروندان باید مافیاها را شناسایی کنند. بازی گفت‌وگو، بلوف و استدلال جمعی.','بازی محلی/کلاسیک',1986,'{رومیزی,کارتی}','{کارآگاهی,استراتژیک,مهمانی}',6,15,'+۱۲',60,'https://images.unsplash.com/photo-1596495578065-6e0763fa1178?w=800&q=80',true,4200),
('۱۳ سرنخ','بازی استنتاجی که هر بازیکن باید هویت پرونده خود را با استفاده از سرنخ‌های دیگران حدس بزند.','Van Ryder Games',2018,'{رومیزی,کارتی}','{دیداکشن,کارآگاهی,منطقی}',2,4,'+۱۰',30,'https://images.unsplash.com/photo-1606167668584-78701c57f13d?w=800&q=80',true,3100),
('کهربا','بازی معمایی ایرانی با فضای رازآلود و پرونده‌های چندلایه برای گروه‌های کوچک.','استودیو ایرانی',2020,'{رومیزی}','{معمایی,کارآگاهی,خانوادگی}',3,8,'+۱۴',75,'https://images.unsplash.com/photo-1611996575749-79a3a250f948?w=800&q=80',true,1800),
('اتاق آخر','بازی موبایلی فارسی اتاق فرار با معماهای زنجیره‌ای و فضای ترسناک.','استودیو ایرانی',2019,'{اندروید,iOS}','{معمایی,ترسناک,اتاق فرار}',1,1,'+۱۶',180,'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=800&q=80',false,2600),
('Return of the Obra Dinn','بازی استنتاج محض؛ کشف سرنوشت ۶۰ سرنشین یک کشتی تجاری با کمک ساعت جادویی.','Lucas Pope',2018,'{PC,کنسول}','{دیداکشن,کارآگاهی,معمایی}',1,1,'+۱۶',600,'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&q=80',true,5400),
('Ace Attorney','رمان تصویری دادگاهی؛ نقش وکیل مدافعی که با بازجویی شاهدان تناقض‌ها را پیدا می‌کند.','Capcom',2001,'{کنسول,اندروید,iOS,PC}','{کارآگاهی,داستانی,منطقی}',1,1,'+۱۲',900,'https://images.unsplash.com/photo-1589994965851-a8f479c573a9?w=800&q=80',false,4700),
('پرونده باز','بازی کارتی پرونده‌محور با سناریوهای جنایی قابل بازپخش.','آرشیو پرونده',2022,'{کارتی}','{کارآگاهی,دیداکشن}',2,6,'+۱۴',45,'https://images.unsplash.com/photo-1495837174058-628aafc7d610?w=800&q=80',false,900),
('شب‌های سکوت','بازی نقش‌مخفی با مکانیک رای‌گیری شبانه و نقش‌های ویژه کارآگاهی.','استودیو ایرانی',2021,'{رومیزی,اندروید}','{مهمانی,کارآگاهی,استراتژیک}',5,12,'+۱۲',50,'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&q=80',false,1400);

INSERT INTO public.tags (name, status) VALUES ('کارآگاهی','approved'),('ترسناک','approved'),('دیداکشن','approved'),('خانوادگی','approved'),('استراتژیک','approved'),('مهمانی','approved');
