//
(function () {
  var img = document.getElementById("map");
  function pick() {
    var look = document.documentElement.dataset.theme === "light" ? "light" : "dark";
    var phone = window.innerWidth < 760;
    var src = "/art/bodymap-how-pinr-works-" + (phone ? "phone" : "wide") + "-" + look + ".svg";
    if (img.getAttribute("src") !== src) img.setAttribute("src", src);
    img.style.maxWidth = phone ? "560px" : "";
    img.style.margin = phone ? "0 auto" : "";
  }
  pick();
  addEventListener("resize", pick);
  new MutationObserver(pick).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
})();
