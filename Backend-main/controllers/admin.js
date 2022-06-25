const signup = async (req, res, next) => {
    try {
      const email = req.body.email;
      const password = req.body.password;
      const name = req.body.name;
      const phoneNo =req.body.phoneNo;
  
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const errArray = errors.array();
        const err = new Error(errArray[0].msg);
        err.statusCode = 422;
        err.data = errArray;
        throw err;
      }
  
      const existingadmin = await Admin.findOne({ email: email });
      if (existingadmin) {
        const err = new Error("E-Mail address already exists.");
        err.statusCode = 422;
        throw err;
      }
  
      const hashedPassword = await bcrypt.hash(password, 12);
      const activationToken = (await promisify(randomBytes)(20)).toString("hex");
      const admin = new Admin({
        email: email,
        password: hashedPassword,
        name: name,
        phoneNo: phoneNo,
        activationToken: activationToken,
      });
      const savedadmin = await admin.save();
  
  
      // Automatically log in admin after registration
      const token = jwt.sign(
        { adminId: savedadmin._id.toString() },
        process.env.JWT_KEY
      );
  
      // Set cookie in the browser to store authentication state
      const maxAge = 1000 * 60 * 60 * 24 * 3; // 3 days
      res.cookie("token", token, {
        httpOnly: true,
        maxAge: maxAge,
        domain: process.env.DOMAIN,
      });
  
      res.status(201).json({
        message: "Admin successfully created.",
        adminId: savedadmin._id,
      });
    } catch (err) {
      next(err);
    }
  };
  
  const login = async (req, res, next) => {
    try {
      const email = req.body.email;
      const password = req.body.password;
  
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const err = new Error("Input validation failed.");
        err.statusCode = 422;
        err.data = errors.array();
        throw err;
      }
  
      const admin = await Admin.findOne({ email: email });
      if (!admin) {
        const err = new Error("An Admin with this email could not be found.");
        err.statusCode = 404;
        throw err;
      }
  
      const isEqual = await bcrypt.compare(password, admin.password);
      if (!isEqual) {
        const err = new Error("Wrong password.");
        err.statusCode = 401;
        throw err;
      }
  
      const token = jwt.sign(
        { adminId: admin._id.toString() },
        process.env.JWT_KEY
      );
  
      // Set cookie in the browser to store authentication state
      const maxAge = 1000 * 60 * 60; // 1 hour
      res.cookie("token", token, {
        httpOnly: true,
        maxAge: maxAge,
        domain: process.env.DOMAIN,
      });
  
      res.status(201).json({
        message: "admin successfully logged in.",
        token: token,
        adminId: admin._id.toString(),
      });
    } catch (err) {
      next(err);
    }
  };
  
  const logout = (req, res, next) => {
    const adminId = req.adminId;
  
    if (!adminId) {
      const err = new Error("admin is not authenticated.");
      err.statusCode = 401;
      throw err;
    }
  
    res.clearCookie("token", { domain: process.env.DOMAIN });
    res.status(200).json({
      message: "admin successfully logged out.",
      adminId: adminId,
    });
  };
  
  
  const getAdmin = async (req, res, next) => {
    const adminId = req.adminId;
  
    try {
      const admin = await admin.findById(adminId);
  
      if (!adminId || !admin) {
        const err = new Error("admin is not authenticated.");
        err.statusCode = 401;
        throw err;
      }
  
      res.status(200).json({
        message: "admin successfully fetched.",
        adminId: admin._id.toString(),
        email: admin.email,
        name: admin.name,
        phoneNo: admin.phoneNo,
        pages: admin.pages,
      });
    } catch (err) {
      next(err);
    }
  };
  
  const updateadmin = async (req, res, next) => {
    const adminId = req.adminId;
    const name = req.body.name;
    const email = req.body.email;
    const phoneNo = req.body.phoneNo;
    const password = req.body.password;
  
    try {
      const admin = await admin.findById(adminId);
  
      if (!adminId || !admin) {
        const err = new Error("admin is not authenticated.");
        err.statusCode = 401;
        throw err;
      }
  
      if (password) {
        const hashedPassword = await bcrypt.hash(password, 12);
        admin.password = hashedPassword;
      }
  
      admin.name = name;
      admin.email = email;
      admin.phoneNo = phoneNo;
  
      const savedadmin = await admin.save();
  
      res.status(201).json({
        message: "admin successfully updated.",
        adminId: savedadmin._id.toString(),
        name: savedadmin.name,
        email: savedadmin.email,
        phoneNo: savedadmin.phoneNo,
      });
    } catch (err) {
      next(err);
    }
  };
  
  const getResetToken = async (req, res, next) => {
    const email = req.body.email;
  
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const err = new Error("Input validation failed.");
        err.statusCode = 422;
        err.data = errors.array();
        throw err;
      }
  
      const admin = await admin.findOne({ email: email });
      if (!admin) {
        const err = new Error("An admin with this email could not be found.");
        err.statusCode = 404;
        throw err;
      }
  
      const resetToken = (await promisify(randomBytes)(20)).toString("hex");
      const resetTokenExpiry = Date.now() + 1000 * 60 * 60; // 1 hour from now
      admin.resetToken = resetToken;
      admin.resetTokenExpiry = resetTokenExpiry;
      const savedadmin = await admin.save();
  
      await transport.sendMail({
        from: process.env.MAIL_SENDER,
        to: savedadmin.email,
        subject: "Your Password Reset Token",
        html: resetPasswordTemplate(resetToken),
      });
  
      res.status(200).json({
        message: "Password Reset successfully requested! Check your inbox.",
      });
    } catch (err) {
      next(err);
    }
  };
  
  const resetPassword = async (req, res, next) => {
    const password = req.body.password;
    const resetToken = req.body.resetToken;
  
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const err = new Error("Input validation failed.");
        err.statusCode = 422;
        err.data = errors.array();
        throw err;
      }
  
      const admin = await admin.findOne({
        resetToken: resetToken,
        resetTokenExpiry: { $gt: Date.now() - 1000 * 60 * 60 },
      });
      if (!admin) {
        const err = new Error("The token is either invalid or expired.");
        err.statusCode = 422;
        throw err;
      }
  
      const hashedPassword = await bcrypt.hash(password, 12);
      admin.password = hashedPassword;
      admin.resetToken = null;
      admin.resetTokenExpiry = null;
      const savedadmin = await admin.save();
  
      // Automatically sign in admin after password reset
      const token = jwt.sign(
        { adminId: savedadmin._id.toString() },
        process.env.JWT_KEY
      );
  
      const maxAge = 1000 * 60 * 60; // 1 hour
      res.cookie("token", token, {
        httpOnly: true,
        maxAge: maxAge,
        domain: process.env.DOMAIN,
      });
  
      res.status(201).json({
        message: "Password successfully changed.",
        token: token,
        adminId: savedadmin._id.toString(),
      });
    } catch (err) {
      next(err);
    }
  };
  
  exports.signup = signup;
  exports.login = login;
  exports.logout = logout;
  exports.getAdmin = getAdmin;
  exports.updateadmin = updateadmin;
  exports.getResetToken = getResetToken;
  exports.resetPassword = resetPassword;