export type SiteConfig = typeof siteConfig;

export const siteConfig = {
  name: "Cefiro",
  description: "Any recipe, any source.",
  navItems: [
    {
      label: "Discover",
      href: "/discover",
    },
    {
      label: "My Recipes",
      href: "/library",
    },
    {
      label: "Feed",
      href: "/feed",
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
