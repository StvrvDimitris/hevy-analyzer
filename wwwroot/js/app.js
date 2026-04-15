window.hevyAnalyzer = {
  storage: {
    get: function (key) {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    set: function (key, value) {
      try {
        window.localStorage.setItem(key, value);
      } catch {
      }
    },
    remove: function (key) {
      try {
        window.localStorage.removeItem(key);
      } catch {
      }
    }
  },
  restoreGitHubPagesRoute: function () {
    var params = new URLSearchParams(window.location.search);
    var path = params.get('p');
    if (!path) {
      return;
    }

    var query = params.get('q');
    var url = path + (query ? '?' + query : '') + window.location.hash;
    window.history.replaceState(null, '', url);
  }
};
