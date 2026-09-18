export type SiteConfig = typeof siteConfig;

export const siteConfig = {
  name: "Cefiro",
  description: "Any recipe, any source.",
  navItems: [
    {
      label: "Home",
      href: "/",
    },
    {
      label: "Feed",
      href: "/feed",
    },
    {
      label: "Discover",
      href: "/discover",
    },
    {
      label: "Groceries",
      href: "/groceries",
    },
    {
      label: "Calendar",
      href: "/calendar",
    },
  ],
  navMenuItems: [
    {
      label: "Profile",
      href: "/profile",
    },
  ],
  links: {
    github: "https://github.com/pipozzz/cefiro",
  },
};
