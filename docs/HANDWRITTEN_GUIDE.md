# Candidate handwritten appendix guide

This is a typed calculation guide. The assignment requires your own legible handwritten scan/photos, maximum two pages. Understand the calculation before transcribing it; do not submit this as a fabricated handwritten appendix.

## Page 1: forward pass and chain rule

Given x=1, y=2; w=0.5, b=0, v=1, c=0; learning rate eta=0.1.

z=wx+b=0.5

h=tanh(z)=0.462117157260

y_hat=vh+c=0.462117157260

e=y_hat-y=-1.537882842740

J=0.5 e^2=1.182541818997

The derivatives are evaluated at these original parameters:

- dJ/dy_hat = e
- dJ/dv = e h = -0.710682047486
- dJ/dc = e = -1.537882842740
- dJ/dh = e v
- dh/dz = 1-h^2 = 0.786447732966
- dJ/dw = e v (1-h^2) x = -1.209464475240
- dJ/db = e v (1-h^2) = -1.209464475240

Draw the chain x,w,b -> z -> tanh -> h,v,c -> y_hat -> J. Label the local derivatives.

## Page 2: simultaneous update and verification

All new parameters use the original gradients:

- w_new = 0.5 - 0.1(-1.209464475240) = 0.620946447524
- b_new = 0 - 0.1(-1.209464475240) = 0.120946447524
- v_new = 1 - 0.1(-0.710682047486) = 1.071068204749
- c_new = 0 - 0.1(-1.537882842740) = 0.153788284274

The first updated loss is 0.685773765045. All initial gradients are negative, so subtracting them increases all four parameters. At this point the prediction is below target; these increases raise the prediction locally and reduce the loss.

For each parameter theta_i, approximate the initial gradient with:

g_i = [J(theta + epsilon e_i) - J(theta - epsilon e_i)] / (2 epsilon), epsilon=1e-6.

Observed maximum absolute discrepancy: 1.1302e-10, below 1e-5. Round-off means central differences are approximate; making epsilon arbitrarily small can worsen cancellation error.

The C++ code performs the first update, then 100 additional simultaneous updates. The final loss is approximately 1.0805e-20. This is one-sample fitting, not evidence of generalisation. Include a short explanation in your own words and refer to the exported loss plot.
