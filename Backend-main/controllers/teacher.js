const signup = async (req, res, next) => {
    try {
      const email = req.body.email;
      const password = req.body.password;
      const name = req.body.name;
      const phoneNo =req.body.phoneNo;
      const course = req.body.course;
  
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const errArray = errors.array();
        const err = new Error(errArray[0].msg);
        err.statusCode = 422;
        err.data = errArray;
        throw err;
      }
  
      const existingUser = await Teacher.findOne({ email: email });
      if (existingUser) {
        const err = new Error("E-Mail address already exists.");
        err.statusCode = 422;
        throw err;
      }
  
      const hashedPassword = await bcrypt.hash(password, 12);
      const activationToken = (await promisify(randomBytes)(20)).toString("hex");
      const teacher = new Teacher({
        email: email,
        password: hashedPassword,
        name: name,
        phoneNo: phoneNo,
        activationToken: activationToken,
        course: course,
      });
      const savedTeacher = await teacher.save();
  
  
      // Automatically log in teacher after registration
      const token = jwt.sign(
        { teacherId: savedTeacher._id.toString() },
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
        message: "Teacher successfully created.",
        teacherId: savedTeacher._id,
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
  
      const teacher = await Teacher.findOne({ email: email });
      if (!teacher) {
        const err = new Error("An teacher with this email could not be found.");
        err.statusCode = 404;
        throw err;
      }
  
      const isEqual = await bcrypt.compare(password, teacher.password);
      if (!isEqual) {
        const err = new Error("Wrong password.");
        err.statusCode = 401;
        throw err;
      }
  
      const token = jwt.sign(
        { teacherId: teacher._id.toString() },
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
        message: "Teacher successfully logged in.",
        token: token,
        teacherId: teacher._id.toString(),
      });
    } catch (err) {
      next(err);
    }
  };
  
  const logout = (req, res, next) => {
    const teacherId = req.teacherId;
  
    if (!teacherId) {
      const err = new Error("Teacher is not authenticated.");
      err.statusCode = 401;
      throw err;
    }
  
    res.clearCookie("token", { domain: process.env.DOMAIN });
    res.status(200).json({
      message: "Teacher successfully logged out.",
      teacherId: teacherId,
    });
  };
  
  
  const getTeacher = async (req, res, next) => {
    const teacherId = req.teacherId;
  
    try {
      const teacher = await Teacher.findById(teacherId);
  
      if (!teacherId || !teacher) {
        const err = new Error("Teacher is not authenticated.");
        err.statusCode = 401;
        throw err;
      }
  
      res.status(200).json({
        message: "Teacher successfully fetched.",
        teacherId: teacher._id.toString(),
        email: teacher.email,
        name: teacher.name,
        phoneNo: teacher.phoneNo,
        course: teacher.course,
        pages: teacher.pages,
      });
    } catch (err) {
      next(err);
    }
  };
  
  const updateTeacher = async (req, res, next) => {
    const teacherId = req.teacherId;
    const name = req.body.name;
    const email = req.body.email;
    const phoneNo = req.body.phoneNo;
    const password = req.body.password;
  
    try {
      const teacher = await Teacher.findById(teacherId);
  
      if (!teacherId || !teacher) {
        const err = new Error("Teacher is not authenticated.");
        err.statusCode = 401;
        throw err;
      }
  
      if (password) {
        const hashedPassword = await bcrypt.hash(password, 12);
        teacher.password = hashedPassword;
      }
  
      teacher.name = name;
      teacher.email = email;
      teacher.phoneNo = phoneNo;
  
      const savedTeacher = await teacher.save();
  
      res.status(201).json({
        message: "Teacher successfully updated.",
        teacherId: savedTeacher._id.toString(),
        name: savedTeacher.name,
        email: savedTeacher.email,
        phoneNo: savedTeacher.phoneNo,
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
  
      const teacher = await Teacher.findOne({ email: email });
      if (!teacher) {
        const err = new Error("An teacher with this email could not be found.");
        err.statusCode = 404;
        throw err;
      }
  
      const resetToken = (await promisify(randomBytes)(20)).toString("hex");
      const resetTokenExpiry = Date.now() + 1000 * 60 * 60; // 1 hour from now
      teacher.resetToken = resetToken;
      teacher.resetTokenExpiry = resetTokenExpiry;
      const savedTeacher = await teacher.save();
  
      await transport.sendMail({
        from: process.env.MAIL_SENDER,
        to: savedTeacher.email,
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
  
      const teacher = await Teacher.findOne({
        resetToken: resetToken,
        resetTokenExpiry: { $gt: Date.now() - 1000 * 60 * 60 },
      });
      if (!teacher) {
        const err = new Error("The token is either invalid or expired.");
        err.statusCode = 422;
        throw err;
      }
  
      const hashedPassword = await bcrypt.hash(password, 12);
      teacher.password = hashedPassword;
      teacher.resetToken = null;
      teacher.resetTokenExpiry = null;
      const savedTeacher = await teacher.save();
  
      // Automatically sign in teacher after password reset
      const token = jwt.sign(
        { teacherId: savedTeacher._id.toString() },
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
        teacherId: savedTeacher._id.toString(),
      });
    } catch (err) {
      next(err);
    }
  };
  
  exports.signup = signup;
  exports.login = login;
  exports.logout = logout;
  exports.getTeacher = getTeacher;
  exports.updateTeacher = updateTeacher;
  exports.getResetToken = getResetToken;
  exports.resetPassword = resetPassword;