document.addEventListener("DOMContentLoaded", () => {
  const SVG_NS = "http://www.w3.org/2000/svg";

  // Eyelash data
  const leftLashData = "M94,200 C120,165 180,165 210,180 L195,175 M165,165 L160,155 M130,165 L135,155";
  const rightLashData = "M507,200 C480,165 420,165 390,180 L405,175 M435,165 L440,155 M470,165 L465,155";

  // Find insertion points
  const leftBezel = document.getElementById("eyeBezelL");
  const rightBezel = document.getElementById("eyeBezelR");

  if (leftBezel) {
    const leftLash = document.createElementNS(SVG_NS, "path");
    leftLash.setAttribute("class", "eyelash");
    leftLash.setAttribute("d", leftLashData);
    // Insert after the bezel
    leftBezel.parentNode.insertBefore(leftLash, leftBezel.nextSibling);
  }

  if (rightBezel) {
    const rightLash = document.createElementNS(SVG_NS, "path");
    rightLash.setAttribute("class", "eyelash");
    rightLash.setAttribute("d", rightLashData);
    // Insert after the bezel
    rightBezel.parentNode.insertBefore(rightLash, rightBezel.nextSibling);
  }
});
