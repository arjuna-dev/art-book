# Re-run the plotting code (the notebook state was reset).

import math
import numpy as np
import matplotlib.pyplot as plt

# --------- configuration ---------
turns = 3.0  # number of full turns of the spiral
n_center = 10_000_000  # huge number at the center (10^7 ~ 6.2% prime rate)
n_outer = 100  # we finish at 100 with 25%
R0 = 1.0  # inner radius
R1 = 6.0  # outer radius after 'turns' turns
samples = 600  # number of points along the spiral
sieve_cap = 1_000_000  # compute exact π(n) for n <= 1e6; PNT beyond


# --------- helpers ---------
def sieve_pi_prefix(N):
    sieve = bytearray(b"\x01") * (N + 1)
    sieve[0:2] = b"\x00\x00"
    lim = int(N**0.5)
    for p in range(2, lim + 1):
        if sieve[p]:
            start = p * p
            step = p
            sieve[start : N + 1 : step] = b"\x00" * (((N - start) // step) + 1)
    pi = np.zeros(N + 1, dtype=np.int32)
    c = 0
    for k in range(N + 1):
        if sieve[k]:
            c += 1
        pi[k] = c
    return pi


def prime_ratio(n, pi_table):
    n_int = int(n)
    if n_int <= 1:
        return 0.0
    if n_int <= len(pi_table) - 1:
        return pi_table[n_int] / n_int
    return 1.0 / math.log(n)


# --------- parameterize spiral and mapping ---------
theta0 = 0.0
theta1 = 2 * math.pi * turns

# Radius parameters: r = A * exp(B*theta)
B = math.log(R1 / R0) / (theta1 - theta0)
A = R0

# Number mapping: n(theta) = n_center * exp(-C * (theta-theta0))
C = math.log(n_center / n_outer) / (theta1 - theta0)

# Precompute exact prime counts up to sieve_cap
pi_table = sieve_pi_prefix(sieve_cap)

# Sample theta, compute n, r and coordinates
thetas = np.linspace(theta0, theta1, samples)
ns = n_center * np.exp(-C * (thetas - theta0))

# Enforce exact n=100 at the outermost point
ns[-1] = n_outer

# Compute ratios
ratios = np.array([prime_ratio(n, pi_table) for n in ns])

# Spiral coords
rs = A * np.exp(B * thetas)
xs = rs * np.cos(thetas)
ys = rs * np.sin(thetas)

# --------- plot ---------
fig, ax = plt.subplots(figsize=(7.5, 7.5))

# Spiral backbone
theta_curve = np.linspace(theta0, theta1, 800)
r_curve = A * np.exp(B * theta_curve)
x_curve = r_curve * np.cos(theta_curve)
y_curve = r_curve * np.sin(theta_curve)
ax.plot(x_curve, y_curve, linewidth=1)

# Scatter colored by prime ratio π(n)/n
sc = ax.scatter(xs, ys, c=ratios, s=20)

# Annotate center
ax.text(
    xs[0],
    ys[0],
    f" center n≈{int(ns[0]):,}\n π(n)/n≈{ratios[0]:.3f}",
    ha="left",
    va="bottom",
)

# Annotate outer n=100 with 25%
x_ann, y_ann = xs[-1], ys[-1]
pi_100 = 25
ratio_100 = pi_100 / n_outer
ax.plot([0, x_ann], [0, y_ann], linestyle=":", linewidth=1)
ax.text(
    x_ann,
    y_ann,
    f" n=100 → π(100)/100 = {ratio_100:.2f}\n inverse = 4",
    ha="right",
    va="top",
)

# Colorbar
cbar = plt.colorbar(sc, ax=ax)
cbar.set_label("Prime ratio π(n)/n")

ax.set_aspect("equal", adjustable="box")
ax.set_title(
    "Logarithmic Shell with Prime Ratio π(n)/n\n(center: huge n, outer rim: n=100 → 25%)"
)
ax.set_xlabel("x")
ax.set_ylabel("y")
ax.grid(False)
plt.tight_layout()
plt.show()
