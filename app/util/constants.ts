const Constants = {
  thumbnailUrl:
    "https://api.dicebear.com/9.x/notionists/png?seed={{seed}}&size=256&scale=110&backgroundColor=b6e3f4,c0aede,d1d4f9,cfbbef,e4f4f1&backgroundType=gradientLinear",
  thumbnail: (seed: string) => {
    return Constants.thumbnailUrl.replace("{{seed}}", encodeURI(seed));
  },
};

export default Constants;
